/**
 * Vercel Linux build images bundle no system `yt-dlp`.
 * During `npm run build` on Vercel, `VERCEL=1` — download the matching Linux binary into `bin/yt-dlp`.
 * Local dev: skipped; use brew / PATH.
 */
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binDir = path.join(root, "bin");
const dest = path.join(binDir, "yt-dlp");

if (process.env.VERCEL !== "1") {
  console.log("[fetch-ytdlp] Skip (local build — use system yt-dlp)");
  process.exit(0);
}

const url =
  process.arch === "arm64"
    ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64"
    : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

console.log("[fetch-ytdlp] Downloading", url);
const res = await fetch(url);
if (!res.ok) {
  throw new Error(`[fetch-ytdlp] HTTP ${res.status} ${res.statusText}`);
}
const buf = Buffer.from(await res.arrayBuffer());
await mkdir(binDir, { recursive: true });
await writeFile(dest, buf);
await chmod(dest, 0o755);
console.log("[fetch-ytdlp] Wrote", dest, `(${buf.length} bytes)`);
