import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

function isErrno(e: unknown, code: string): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as NodeJS.ErrnoException).code === code;
}

/** Same search order as the Spring service; `YTDLP_PATH` overrides. */
export function ytdlpCandidates(): string[] {
  const fromEnv = process.env.YTDLP_PATH?.trim();
  const list = [
    fromEnv,
    "/opt/homebrew/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
    "yt-dlp",
  ].filter((x): x is string => Boolean(x));
  return [...new Set(list)];
}

/**
 * Download best audio with yt-dlp to a temp file, return bytes (same cap as before).
 * On Vercel, yt-dlp is usually absent — use `NEXT_PUBLIC_API_URL` to a backend with yt-dlp, or a custom image that includes the binary.
 */
export async function ytdlpAudioToBuffer(
  videoUrl: string,
  maxBytes: number,
  signal?: AbortSignal
): Promise<Buffer> {
  let lastENOENT: Error | null = null;

  for (const bin of ytdlpCandidates()) {
    try {
      const base = path.join(tmpdir(), "next-ytdl");
      await mkdir(base, { recursive: true });
      const filePath = path.join(base, `${Date.now()}-${randomBytes(8).toString("hex")}.audio`);

      await execFileAsync(
        bin,
        ["--no-playlist", "--no-warnings", "-f", "bestaudio/best", "-o", filePath, videoUrl],
        { signal, maxBuffer: 16 * 1024 * 1024 }
      );

      try {
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
      } finally {
        await unlink(filePath).catch(() => {});
      }
    } catch (e) {
      if (isErrno(e, "ENOENT")) {
        lastENOENT = e as Error;
        continue;
      }
      throw e;
    }
  }

  const hint = lastENOENT
    ? " Install yt-dlp (e.g. brew install yt-dlp), set YTDLP_PATH to the binary, or set NEXT_PUBLIC_API_URL to a backend that runs yt-dlp."
    : "";
  throw new Error(`Could not run yt-dlp.${hint}`);
}
