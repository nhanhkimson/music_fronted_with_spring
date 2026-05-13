import { NextRequest, NextResponse } from "next/server";

import { downloadRequestSchema } from "@/lib/schemas/youtube";
import { ytdlpAudioToBuffer } from "@/lib/server/ytdlp-download";

/** NodeOnly; requires yt-dlp on the host or proxy via NEXT_PUBLIC_API_URL from the client. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Avoid OOM on serverless; ~3 minutes of high-bitrate audio is usually below this. */
const MAX_AUDIO_BYTES = 150 * 1024 * 1024;

export function GET() {
  return NextResponse.json(
    { error: "method_not_allowed", message: "use POST" },
    { status: 405 }
  );
}

export async function POST(req: NextRequest) {
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

    const videoUrl = parsed.data.url;
    const buffer = await ytdlpAudioToBuffer(videoUrl, MAX_AUDIO_BYTES, req.signal);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="audio"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "something went wrong";
    const status = /could not run yt-dlp/i.test(msg) ? 503 : 502;
    return NextResponse.json({ error: "download_failed", message: msg }, { status });
  }
}
