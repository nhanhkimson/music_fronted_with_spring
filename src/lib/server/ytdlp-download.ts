import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function isErrno(e: unknown, code: string): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as NodeJS.ErrnoException).code === code;
}

function execStderr(e: unknown): string {
  if (e && typeof e === "object" && "stderr" in e) {
    const s = (e as { stderr?: Buffer | string }).stderr;
    if (Buffer.isBuffer(s)) return s.toString("utf8");
    if (typeof s === "string") return s;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Prefer alternate Innertube clients; datacenter IPs often hit "not a bot" on default web client. */
const YOUTUBE_EXTRACTOR_VARIANTS: readonly (readonly string[])[] = [
  ["--extractor-args", "youtube:player_client=android,web"],
  ["--extractor-args", "youtube:player_client=android_tv,tv,web"],
  ["--extractor-args", "youtube:player_client=ios,web"],
  ["--extractor-args", "youtube:player_client=mweb,web"],
  [],
] as const;

function looksLikeYoutubeBotOrAuthBlock(stderr: string): boolean {
  return /not a bot|Sign in to confirm|login required|please sign in|confirm your age|Only images/i.test(
    stderr
  );
}

/** Netscape cookies file, base64-encoded (Vercel-friendly). See yt-dlp wiki "Exporting YouTube cookies". */
async function cookiesFileFromEnv(): Promise<string | null> {
  const b64 = process.env.YTDLP_COOKIES_B64?.trim();
  if (!b64) return null;
  const dir = await mkdtemp(path.join(tmpdir(), "ytdl-cookies-"));
  const p = path.join(dir, "cookies.txt");
  await writeFile(p, Buffer.from(b64, "base64"), { mode: 0o600 });
  return p;
}

/** Vercel: `prebuild` drops `bin/yt-dlp` (Linux). Local: Homebrew / PATH. `YTDLP_PATH` overrides all. */
export function ytdlpCandidates(): string[] {
  const fromEnv = process.env.YTDLP_PATH?.trim();
  const bundled = path.join(process.cwd(), "bin", "yt-dlp");
  const list = [
    fromEnv,
    existsSync(bundled) ? bundled : null,
    "/opt/homebrew/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
    "yt-dlp",
  ].filter((x): x is string => Boolean(x));
  return [...new Set(list)];
}

async function readFileToBuffer(filePath: string, maxBytes: number): Promise<Buffer> {
  const { size } = await stat(filePath);
  if (size > maxBytes) {
    throw new Error(
      `Audio exceeds size limit for this server (~${Math.floor(maxBytes / (1024 * 1024))} MB). Try a shorter video.`
    );
  }

  const chunks: Buffer[] = [];
  let total = 0;
  const rs = createReadStream(filePath);
  try {
    for await (const chunk of rs) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > maxBytes) {
        throw new Error(
          `Audio exceeds size limit for this server (~${Math.floor(maxBytes / (1024 * 1024))} MB).`
        );
      }
      chunks.push(buf);
    }
  } finally {
    rs.destroy();
  }
  return Buffer.concat(chunks);
}

/**
 * Download best audio with yt-dlp to a temp file, return bytes (same cap as before).
 * Retries alternate YouTube player clients on bot challenges. Optional `YTDLP_COOKIES_B64` for stubborn blocks.
 */
export async function ytdlpAudioToBuffer(
  videoUrl: string,
  maxBytes: number,
  signal?: AbortSignal
): Promise<Buffer> {
  let lastENOENT: Error | null = null;
  const cookiesPath = await cookiesFileFromEnv();
  const cookiesArgs = cookiesPath ? (["--cookies", cookiesPath] as const) : ([] as const);

  for (const bin of ytdlpCandidates()) {
    let brokeBins = false;

    for (let vi = 0; vi < YOUTUBE_EXTRACTOR_VARIANTS.length; vi++) {
      const variant = YOUTUBE_EXTRACTOR_VARIANTS[vi]!;
      const base = path.join(tmpdir(), "next-ytdl");
      await mkdir(base, { recursive: true });
      const filePath = path.join(base, `${Date.now()}-${randomBytes(8).toString("hex")}.audio`);

      const args = [
        "--no-playlist",
        "--no-warnings",
        ...cookiesArgs,
        ...variant,
        "-f",
        "bestaudio/best",
        "-o",
        filePath,
        videoUrl,
      ];

      try {
        await execFileAsync(bin, args, { signal, maxBuffer: 16 * 1024 * 1024 });
      } catch (execErr) {
        await unlink(filePath).catch(() => {});

        if (isErrno(execErr, "ENOENT")) {
          lastENOENT = execErr as Error;
          brokeBins = true;
          break;
        }

        const errText = execStderr(execErr);
        const lastVariant = vi === YOUTUBE_EXTRACTOR_VARIANTS.length - 1;

        if (looksLikeYoutubeBotOrAuthBlock(errText) && !lastVariant) {
          continue;
        }

        const cookieHint =
          !cookiesPath && looksLikeYoutubeBotOrAuthBlock(errText)
            ? " Optional: set Vercel env YTDLP_COOKIES_B64 (base64 Netscape cookies.txt from a logged-in browser). https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies — or use a residential / non-datacenter host for yt-dlp."
            : "";

        throw new Error((errText || "yt-dlp failed").trim() + cookieHint);
      }

      try {
        return await readFileToBuffer(filePath, maxBytes);
      } finally {
        await unlink(filePath).catch(() => {});
      }
    }

    if (brokeBins) {
      break;
    }
  }

  const hint = lastENOENT
    ? " Install yt-dlp (e.g. brew install yt-dlp), set YTDLP_PATH, or on Vercel ensure `prebuild` ran (bundles bin/yt-dlp); optionally set NEXT_PUBLIC_API_URL to an external API."
    : "";
  throw new Error(`Could not run yt-dlp.${hint}`);
}
