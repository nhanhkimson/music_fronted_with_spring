/** Same rule as the Spring API / Zod form schema */
export const YOUTUBE_URL_REGEX =
  /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{11}([?&#].*)?$/i;

export function isValidYoutubeUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  return YOUTUBE_URL_REGEX.test(url.trim());
}
