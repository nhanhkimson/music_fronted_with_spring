import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const TIMEOUT_MS = 10 * 60 * 1000;

export async function downloadYoutubeAudioMp3(
  youtubeUrl: string,
  ytDlpExecutable: string
): Promise<{ buffer: Buffer; workDir: string }> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "yt-mp3-"));
  const outputTemplate = path.join(workDir, "audio.%(ext)s");

  const args = [
    "-x",
    "--audio-format",
    "mp3",
    "--no-playlist",
    "--no-warnings",
    "--quiet",
    "-o",
    outputTemplate,
    youtubeUrl.trim(),
  ];

  const log = await runWithTimeout(ytDlpExecutable, args, workDir, TIMEOUT_MS);

  if (log.code !== 0) {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    const tail =
      log.output.length > 2000 ? log.output.slice(-2000) : log.output;
    throw new Error(`yt-dlp failed: ${tail.trim() || "exit " + log.code}`);
  }

  const entries = await fs.readdir(workDir);
  const mp3Names = entries.filter((f) => f.endsWith(".mp3"));
  if (mp3Names.length === 0) {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    throw new Error("no MP3 file produced by yt-dlp (is ffmpeg installed?)");
  }
  if (mp3Names.length > 1) {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    throw new Error("unexpected multiple MP3 files");
  }

  const mp3Path = path.join(workDir, mp3Names[0]);
  const buffer = await fs.readFile(mp3Path);
  return { buffer, workDir };
}

function runWithTimeout(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf-8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf-8");
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("yt-dlp timed out"));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output });
    });
  });
}
