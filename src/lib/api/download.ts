import axios, { isAxiosError } from "axios";

import type { ErrorResponseBody } from "@/types/api";

/** Same-origin `/api/download`, or external API base + `/api/download`. */
function downloadEndpoint(): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!base) {
    return "/api/download";
  }
  return `${base.replace(/\/$/, "")}/api/download`;
}

function hintForProduction(): string {
  if (typeof window === "undefined") return "";
  const isHttpsSite = window.location.protocol === "https:";
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  const lines: string[] = [];

  if (apiBase?.startsWith("http://") && isHttpsSite) {
    lines.push(
      "Your site uses HTTPS but NEXT_PUBLIC_API_URL uses http:// — use https:// for the API."
    );
  }
  if (apiBase) {
    lines.push(
      `If this persists, check CORS on the API for origin: ${window.location.origin}.`
    );
  }

  return lines.length ? " " + lines.join(" ") : "";
}

function filenameFromDisposition(header: string | undefined): string | null {
  if (!header || typeof header !== "string") return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^["']|["']$/g, ""));
    } catch {
      return star[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  if (plain) return plain[1];
  const plain2 = /filename=([^;\s]+)/i.exec(header);
  if (plain2) return plain2[1].replace(/^["']|["']$/g, "");
  return null;
}

const client = axios.create({
  timeout: 600_000,
  headers: { "Content-Type": "application/json" },
});

export async function requestYoutubeMp3Download(url: string): Promise<void> {
  const endpoint = downloadEndpoint();

  let response;
  try {
    response = await client.post<ArrayBuffer>(
      endpoint,
      { url },
      {
        responseType: "arraybuffer",
        validateStatus: () => true,
      }
    );
  } catch (e) {
    if (isAxiosError(e) && !e.response) {
      throw new Error(
        `Network error — could not reach ${endpoint}.${hintForProduction()}`
      );
    }
    throw e;
  }

  const rawCt = response.headers["content-type"];
  const contentType =
    typeof rawCt === "string" ? rawCt : Array.isArray(rawCt) ? (rawCt[0] ?? "") : "";

  const disposition =
    response.headers["content-disposition"] ?? response.headers["Content-Disposition"];
  const cd =
    typeof disposition === "string"
      ? disposition
      : Array.isArray(disposition)
        ? disposition[0]
        : undefined;
  const filename = filenameFromDisposition(cd) ?? "audio";

  const isAudio =
    contentType.includes("audio/") || contentType.includes("application/octet-stream");

  if (response.status === 200 && isAudio) {
    const blob = new Blob([response.data], {
      type: contentType.split(";")[0].trim() || "application/octet-stream",
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
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
