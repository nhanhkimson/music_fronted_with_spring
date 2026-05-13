import { spawnSync } from "node:child_process";

/**
 * Resolve a working yt-dlp binary (PATH + common Homebrew locations).
 * Optional: set YT_DLP_PATH in .env.local to a full path.
 */
export function resolveYtDlpExecutable(): string {
  const fromEnv = process.env.YT_DLP_PATH?.trim();
  const candidates = [
    fromEnv,
    "/opt/homebrew/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
    "yt-dlp",
  ].filter((c): c is string => Boolean(c));

  const tried = new Set<string>();
  for (const cmd of candidates) {
    if (tried.has(cmd)) continue;
    tried.add(cmd);
    try {
      const r = spawnSync(cmd, ["--version"], {
        encoding: "utf-8",
        timeout: 10_000,
        shell: false,
      });
      if (r.status === 0) {
        return cmd;
      }
    } catch {
      // try next
    }
  }

  throw new Error(
    "yt-dlp not found. Install: brew install yt-dlp ffmpeg (macOS). " +
      "From some IDEs set YT_DLP_PATH=/opt/homebrew/bin/yt-dlp in .env.local."
  );
}
