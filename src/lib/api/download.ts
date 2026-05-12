import axios from "axios";

import type { ErrorResponseBody } from "@/types/api";

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
  timeout: 600_000,
  headers: { "Content-Type": "application/json" },
});

export async function requestYoutubeMp3Download(url: string): Promise<void> {
  const response = await client.post<ArrayBuffer>(
    "/api/download",
    { url },
    {
      responseType: "arraybuffer",
      validateStatus: () => true,
    }
  );

  const rawCt = response.headers["content-type"];
  const contentType =
    typeof rawCt === "string" ? rawCt : Array.isArray(rawCt) ? (rawCt[0] ?? "") : "";

  if (response.status === 200 && contentType.includes("audio/mpeg")) {
    const blob = new Blob([response.data], { type: "audio/mpeg" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "audio.mp3";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
    return;
  }

  let message = `Download failed (${response.status})`;
  try {
    const text = new TextDecoder().decode(response.data);
    const body = JSON.parse(text) as ErrorResponseBody;
    if (body.message) {
      message = body.message;
    }
  } catch {
    // keep generic message
  }

  throw new Error(message);
}
