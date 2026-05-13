import type { ErrorResponseBody } from "@/types/api";

/** Same-origin `/api/download`, or external API base + `/api/download`. */
function downloadEndpoint(): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!base) {
    return "/api/download";
  }
  return `${base.replace(/\/$/, "")}/api/download`;
}

function hintForMixedContent(): string {
  if (typeof window === "undefined") return "";
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (apiBase?.startsWith("http://") && window.location.protocol === "https:") {
    return " Your NEXT_PUBLIC_API_URL must use https:// on Vercel.";
  }
  if (apiBase) {
    return ` If the API is remote, check it is online and allows CORS for ${window.location.origin}.`;
  }
  return "";
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
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

/**
 * fetch handles streamed / large bodies reliably; axios + arraybuffer often causes "Network Error"
 * when the server buffers a long audio response.
 */
export async function requestYoutubeMp3Download(url: string): Promise<void> {
  const endpoint = downloadEndpoint();

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      credentials: "same-origin",
    });
  } catch {
    throw new Error(
      `Network error — could not reach ${endpoint}.${hintForMixedContent()}`
    );
  }

  const disposition = res.headers.get("content-disposition");
  const filename = filenameFromDisposition(disposition) ?? "audio";

  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const text = await res.text();
      const body = JSON.parse(text) as ErrorResponseBody;
      if (body.message) {
        message = body.message;
      }
    } catch {
      // keep generic message
    }
    throw new Error(message);
  }

  // Success: binary body. Do not require Content-Type to include audio/* or octet-stream —
  // on cross-origin fetch, non–safelisted Content-Type values are often hidden from JS (empty string),
  // which incorrectly looked like failure even for HTTP 200.
  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error("Download failed (empty response)");
  }

  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
