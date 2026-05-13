import { z } from "zod";

import { YOUTUBE_URL_REGEX } from "@/lib/youtube-url";

export const downloadFormSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .regex(YOUTUBE_URL_REGEX, "Enter a valid YouTube URL"),
});

export type DownloadFormValues = z.infer<typeof downloadFormSchema>;

/** JSON body for POST /api/download — same shape as the Spring API */
export const downloadRequestSchema = z.object({
  url: z
    .string()
    .min(1, "url is required")
    .regex(YOUTUBE_URL_REGEX, "invalid YouTube URL"),
});

export type DownloadRequestBody = z.infer<typeof downloadRequestSchema>;
