import { promises as fs } from "node:fs";
import { NextRequest, NextResponse } from "next/server";

import { downloadRequestSchema } from "@/lib/schemas/youtube";
import { resolveYtDlpExecutable } from "@/lib/server/resolve-ytdlp";
import { downloadYoutubeAudioMp3 } from "@/lib/server/ytdlp-mp3";

/** Needs Node — spawns yt-dlp / ffmpeg (not supported on Edge / typical Vercel hobby limits). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export function GET() {
  return NextResponse.json(
    { error: "method_not_allowed", message: "use POST" },
    { status: 405 }
  );
}

export async function POST(req: NextRequest) {
  // Vercel serverless has no yt-dlp/ffmpeg and tight timeouts — use an external API URL instead.
  if (process.env.VERCEL) {
    return NextResponse.json(
      {
        error: "not_available",
        message:
          "This route cannot run on Vercel (no yt-dlp/ffmpeg). Set NEXT_PUBLIC_API_URL in Vercel to your deployed API (e.g. Fly.io Spring backend) and redeploy.",
      },
      { status: 503 }
    );
  }

  let workDir: string | null = null;
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json(
        { error: "validation_error", message: "expected JSON body" },
        { status: 400 }
      );
    }

    const parsed = downloadRequestSchema.safeParse(json);
    if (!parsed.success) {
      const first =
        parsed.error.flatten().fieldErrors.url?.[0] ?? "request validation failed";
      return NextResponse.json(
        { error: "validation_error", message: first },
        { status: 400 }
      );
    }

    let ytDlp: string;
    try {
      ytDlp = resolveYtDlpExecutable();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "yt-dlp not found";
      return NextResponse.json(
        { error: "download_failed", message: msg },
        { status: 502 }
      );
    }

    const { buffer, workDir: wd } = await downloadYoutubeAudioMp3(
      parsed.data.url,
      ytDlp
    );
    workDir = wd;

    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    workDir = null;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'attachment; filename="audio.mp3"',
      },
    });
  } catch (e) {
    if (workDir) {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
    const msg = e instanceof Error ? e.message : "something went wrong";
    return NextResponse.json(
      { error: "download_failed", message: msg },
      { status: 502 }
    );
  }
}
