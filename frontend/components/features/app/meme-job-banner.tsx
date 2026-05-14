"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import type { JobStatusResponse } from "@/app/api/meme/job-status/[jobId]/route";
import { useJobContext } from "@/components/features/app/job-context";
import {
  getMemeCompletionActionLabel,
  shouldOpenMemeCompletionUI,
} from "@/lib/meme/job-completion";

const POLL_INTERVAL_MS = 3000;

export function MemeJobBanner() {
  const {
    activeJob,
    completedJobData,
    completionUiOpen,
    jobFailure,
    secondVariantTrack,
    openCompletionUi,
    markJobCompleted,
    clearSecondVariantTrack,
    clearJob,
  } = useJobContext();

  const [secondVariantStatus, setSecondVariantStatus] =
    useState<JobStatusResponse | null>(null);
  const secondVariantPollBusyRef = useRef(false);

  const pollSecondVariant = useCallback(async () => {
    if (!secondVariantTrack?.jobId || secondVariantPollBusyRef.current) return;
    secondVariantPollBusyRef.current = true;

    try {
      const res = await fetch(
        `/api/meme/job-status/${secondVariantTrack.jobId}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;

      const data = (await res.json()) as JobStatusResponse;
      setSecondVariantStatus(data);

      const variantCount = data.variantSignedUrls?.length ?? 0;
      if (variantCount >= 2) {
        clearSecondVariantTrack();
        markJobCompleted(data);
        return;
      }

      if (data.secondVariantError) {
        clearSecondVariantTrack();
        setSecondVariantStatus(null);
        toast.error(data.secondVariantError);
      }
    } catch {
      /* Netzwerkfehler – beim nächsten Intervall erneut versuchen */
    } finally {
      secondVariantPollBusyRef.current = false;
    }
  }, [
    clearSecondVariantTrack,
    markJobCompleted,
    secondVariantTrack?.jobId,
  ]);

  useEffect(() => {
    if (!secondVariantTrack?.jobId) {
      setSecondVariantStatus(null);
      return;
    }

    void pollSecondVariant();
    const interval = setInterval(() => void pollSecondVariant(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pollSecondVariant, secondVariantTrack?.jobId]);

  const ready =
    completedJobData != null && shouldOpenMemeCompletionUI(completedJobData);
  const running = activeJob != null;
  const secondVariantRunning = secondVariantTrack != null;
  const secondVariantReady =
    (secondVariantStatus?.variantSignedUrls?.length ?? 0) >= 2;
  const showReadyBanner = ready && !completionUiOpen && !secondVariantRunning;

  if (!running && !showReadyBanner && !jobFailure && !secondVariantRunning) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-[45] px-4">
      <div className="pointer-events-auto mx-auto max-w-md space-y-2">
        {running ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-xl border border-orange-500/35 bg-zinc-900/95 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-300"
              aria-hidden
            >
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-50">
                Meme wird erstellt
              </p>
              <p className="text-xs text-zinc-400">
                Du kannst weiter in der App navigieren.
              </p>
            </div>
          </div>
        ) : null}

        {secondVariantRunning ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-orange-500/35 bg-zinc-900/95 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-300"
                aria-hidden
              >
                {secondVariantReady ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-50">
                  {secondVariantReady
                    ? "Beide Varianten stehen bereit"
                    : "Zweite Variante wird erstellt"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {secondVariantReady
                    ? "Wähle eine Variante zum Posten."
                    : "Du kannst weiter in der App navigieren."}
                </p>
              </div>
            </div>
            {secondVariantReady ? (
              <button
                type="button"
                onClick={openCompletionUi}
                className="mt-3 flex w-full items-center justify-center rounded-full bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-400"
              >
                Variante wählen
              </button>
            ) : null}
          </div>
        ) : null}

        {showReadyBanner && completedJobData ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-emerald-500/35 bg-gradient-to-b from-emerald-950/55 to-zinc-900/95 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"
                aria-hidden
              >
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-50">
                  Dein Meme ist fertig
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {completedJobData.variantSignedUrls &&
                  completedJobData.variantSignedUrls.length >= 2
                    ? "Zwei Varianten stehen zur Auswahl bereit."
                    : "Vorschau, Variantenwahl oder Posten – direkt hier."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openCompletionUi}
              className="mt-3 flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              {getMemeCompletionActionLabel(completedJobData)}
            </button>
          </div>
        ) : null}

        {jobFailure ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-500/35 bg-red-950/80 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur"
          >
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300"
              aria-hidden
            >
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-50">
                Meme-Erstellung fehlgeschlagen
              </p>
              <p className="mt-0.5 text-xs text-red-100/90">{jobFailure}</p>
            </div>
            <button
              type="button"
              onClick={clearJob}
              className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-200"
              aria-label="Hinweis schließen"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
