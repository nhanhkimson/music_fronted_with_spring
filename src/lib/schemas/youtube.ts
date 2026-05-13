import { z } from "zod";

import { CANONICAL_YOUTUBE_WATCH_REGEX, normalizeYoutubeUrl } from "@/lib/youtube-url";

export const downloadFormSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .transform((s) => normalizeYoutubeUrl(s))
    .refine((s) => CANONICAL_YOUTUBE_WATCH_REGEX.test(s), {
      message: "Enter a valid YouTube URL",
    }),
});

export type DownloadFormValues = z.infer<typeof downloadFormSchema>;

/** JSON body for POST /api/download — same shape as the Spring API */
export const downloadRequestSchema = z.object({
  url: z
    .string()
    .min(1, "url is required")
    .transform((s) => normalizeYoutubeUrl(s))
    .refine((s) => CANONICAL_YOUTUBE_WATCH_REGEX.test(s), {
      message: "invalid YouTube URL",
    }),
});

export type DownloadRequestBody = z.infer<typeof downloadRequestSchema>;
