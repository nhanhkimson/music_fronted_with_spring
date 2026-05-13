import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import play from "play-dl";

import { downloadRequestSchema } from "@/lib/schemas/youtube";

/** Pure Node; uses play-dl (no yt-dlp/ffmpeg). Works on Vercel within plan limits. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function mediaForPlayDlType(streamType: string): { mime: string; ext: string } {
  if (streamType === "webm/opus" || streamType === "opus") {
    return { mime: "audio/webm", ext: "webm" };
  }
  if (streamType === "ogg/opus") {
    return { mime: "audio/ogg", ext: "ogg" };
  }
  if (streamType === "raw" || streamType === "arbitrary") {
    return { mime: "application/octet-stream", ext: "audio" };
  }
  return { mime: "audio/webm", ext: "webm" };
}

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

    const videoUrl = parsed.data.url.trim();
    const kind = await play.validate(videoUrl);
    if (kind !== "yt_video") {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "URL must be a single YouTube video (not a playlist or other source)",
        },
        { status: 400 }
      );
    }

    const ytStream = await play.stream(videoUrl, {
      discordPlayerCompatibility: false,
    });

    const nodeReadable = ytStream.stream as Readable;
    const { mime, ext } = mediaForPlayDlType(String(ytStream.type));
    const body = Readable.toWeb(nodeReadable) as unknown as ReadableStream<Uint8Array>;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="audio.${ext}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "something went wrong";
    return NextResponse.json(
      { error: "download_failed", message: msg },
      { status: 502 }
    );
  }
}
