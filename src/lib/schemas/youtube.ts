import { z } from "zod";

/** Mirrors the backend Java regex for a consistent UX */
const youtubeUrlRegex =
  /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{11}([?&#].*)?$/i;

export const downloadFormSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .regex(youtubeUrlRegex, "Enter a valid YouTube URL"),
});

export type DownloadFormValues = z.infer<typeof downloadFormSchema>;
