/** Same rule as the Spring API / Zod form schema */
export const YOUTUBE_URL_REGEX =
  /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{11}([?&#].*)?$/i;

/** After normalization, URL matches this canonical watch form. */
export const CANONICAL_YOUTUBE_WATCH_REGEX =
  /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/i;

export function isValidYoutubeUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  return YOUTUBE_URL_REGEX.test(url.trim());
}

/**
 * Canonicalize to https://www.youtube.com/watch?v=VIDEO_ID
 * Strips tracking (?si=, etc.) so yt-dlp and players get a stable URL.
 */
export function normalizeYoutubeUrl(raw: string): string {
  const trimmed = raw.trim();
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return trimmed;
  }

  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  let videoId: string | null = null;

  if (host === "youtu.be") {
    const first = u.pathname.replace(/^\//, "").split("/")[0];
    videoId = first && first.length >= 11 ? first.slice(0, 11) : first ?? null;
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    if (u.pathname === "/watch" || u.pathname.startsWith("/watch")) {
      videoId = u.searchParams.get("v");
    } else if (u.pathname.startsWith("/shorts/")) {
      videoId = u.pathname.split("/").filter(Boolean)[1] ?? null;
    } else if (u.pathname.startsWith("/embed/")) {
      videoId = u.pathname.split("/").filter(Boolean)[1] ?? null;
    }
  }

  if (videoId && /^[\w-]{11}$/.test(videoId)) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return trimmed;
}
