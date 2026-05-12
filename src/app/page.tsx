"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestYoutubeMp3Download } from "@/lib/api/download";
import { downloadFormSchema, type DownloadFormValues } from "@/lib/schemas/youtube";

export default function HomePage() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);

  const form = useForm<DownloadFormValues>({
    resolver: zodResolver(downloadFormSchema),
    defaultValues: { url: "" },
    mode: "onSubmit",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setSuccessFlash(false);
    try {
      await requestYoutubeMp3Download(values.url.trim());
      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setSubmitError(msg);
    }
  });

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,_hsl(250_40%_12%)_0%,_transparent_55%)] px-4 py-16">
      <Card className="w-full max-w-md rounded-xl border-border/80 bg-card/90 shadow-2xl shadow-black/40 backdrop-blur-sm">
        <CardHeader className="space-y-2 pb-2 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">YouTube to MP3</CardTitle>
          <CardDescription className="text-muted-foreground">
            Paste a video link and save the audio to your device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2 text-left">
              <Label htmlFor="url" className="text-sm font-medium text-foreground/90">
                YouTube URL
              </Label>
              <Input
                id="url"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={form.formState.isSubmitting}
                className="h-11 rounded-xl border-border/80 bg-background/60"
                {...form.register("url")}
              />
              {form.formState.errors.url?.message ? (
                <p className="text-sm text-destructive" role="alert">
                  {form.formState.errors.url.message}
                </p>
              ) : null}
            </div>

            {submitError ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {submitError}
              </p>
            ) : null}

            {successFlash ? (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400" role="status">
                Download started — check your browser&apos;s downloads.
              </p>
            ) : null}

            <Button
              type="submit"
              className="h-11 w-full rounded-xl text-base font-medium shadow-lg shadow-primary/25"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
                  Working…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-5 w-5" aria-hidden />
                  Download MP3
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
