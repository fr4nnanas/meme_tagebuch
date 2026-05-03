"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Download,
  Loader2,
  Maximize2,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { JobStatusResponse } from "@/app/api/meme/job-status/[jobId]/route";
import { useJobContext } from "@/components/features/app/job-context";
import { requestSecondAiMemeVariant } from "@/lib/actions/upload";

interface VariantPickerModalProps {
  jobId: string;
  variantUrls: string[];
  variantPaths: string[];
  postId: string;
  onConfirm: (
    chosenPath: string,
    discardedPath: string | null,
    caption: string,
  ) => void;
  onDiscard: () => void;
  discardBusy?: boolean;
  isPosting: boolean;
}

export function VariantPickerModal({
  jobId,
  variantUrls,
  variantPaths,
  postId: _postId,
  onConfirm,
  onDiscard,
  discardBusy = false,
  isPosting,
}: VariantPickerModalProps) {
  const { markJobCompleted } = useJobContext();
  const [selected, setSelected] = useState<0 | 1 | null>(
    variantUrls.length >= 2 ? null : 0,
  );
  const [caption, setCaption] = useState("");
  const [secondVariantBusy, setSecondVariantBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const twoVariants = variantUrls.length >= 2;

  useEffect(() => {
    if (variantUrls.length >= 2) {
      setSelected(null);
    } else {
      setSelected(0);
    }
  }, [variantUrls.length, variantUrls.join("|")]);

  const handleDownload = useCallback(async () => {
    if (variantUrls.length === 0) return;
    setDownloadBusy(true);
    try {
      for (let i = 0; i < variantUrls.length; i++) {
        const url = variantUrls[i];
        if (!url) continue;
        const res = await fetch(url);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download =
          variantUrls.length >= 2
            ? `meme_variante_${i + 1}.jpg`
            : `meme.jpg`;
        a.click();
        URL.revokeObjectURL(objectUrl);
        if (i < variantUrls.length - 1) {
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    } catch {
      toast.error("Download fehlgeschlagen");
    } finally {
      setDownloadBusy(false);
    }
  }, [variantUrls]);

  const handleRequestSecondVariant = useCallback(async () => {
    setSecondVariantBusy(true);
    try {
      const res = await requestSecondAiMemeVariant(jobId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const statusRes = await fetch(`/api/meme/job-status/${jobId}`, {
        cache: "no-store",
      });
      if (!statusRes.ok) {
        toast.error("Status konnte nicht geladen werden");
        return;
      }
      const data = (await statusRes.json()) as JobStatusResponse;
      if (data.status !== "completed" || !data.variantSignedUrls?.length) {
        toast.error("Keine zweite Variante empfangen");
        return;
      }
      markJobCompleted(data);
      toast.success("Zweite Variante ist da");
    } catch {
      toast.error("Zweite Variante fehlgeschlagen");
    } finally {
      setSecondVariantBusy(false);
    }
  }, [jobId, markJobCompleted]);

  const handleConfirm = useCallback(() => {
    if (variantUrls.length === 1) {
      onConfirm(variantPaths[0] ?? "", null, caption);
      return;
    }
    if (selected === null) {
      toast.error("Bitte wähle eine Variante aus");
      return;
    }
    const discardedIndex = selected === 0 ? 1 : 0;
    onConfirm(
      variantPaths[selected],
      variantPaths[discardedIndex],
      caption,
    );
  }, [variantUrls.length, variantPaths, selected, caption, onConfirm]);

  const canPost =
    variantUrls.length === 1 ? true : selected !== null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-labelledby="variant-picker-title"
          className="flex h-[min(92dvh,calc(100dvh-env(safe-area-inset-bottom,0px)))] max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-zinc-800 bg-zinc-800 shadow-xl sm:max-h-[min(88vh,800px)] sm:rounded-2xl"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
            <h2
              id="variant-picker-title"
              className="text-lg font-semibold tracking-tight text-zinc-100"
            >
              Wähle deinen Meme-Katalog
            </h2>
            <button
              type="button"
              onClick={() => {
                void onDiscard();
              }}
              aria-label="Entwurf verwerfen"
              disabled={discardBusy || isPosting || secondVariantBusy || downloadBusy}
              className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-40"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <div
              className={`mb-4 grid gap-3 ${
                twoVariants ? "grid-cols-2" : "mx-auto grid-cols-1 sm:max-w-[200px]"
              }`}
            >
              {variantUrls.map((url, idx) => (
                <div
                  key={variantPaths[idx] ?? `${idx}-${url.slice(-24)}`}
                  className={`flex flex-col overflow-hidden rounded-xl border-2 transition-all ${
                    !twoVariants
                      ? "border-zinc-700"
                      : selected === idx
                        ? "border-orange-500 ring-2 ring-orange-500/30"
                        : "border-zinc-700 hover:border-zinc-500"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(url)}
                    className="relative block w-full bg-zinc-900/40"
                    aria-label={`Variante ${idx + 1} vergrößern`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Variante ${idx + 1}`}
                      className="mx-auto max-h-40 w-full object-contain sm:max-h-44"
                    />
                    <div className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                      <Maximize2 className="h-4 w-4" aria-hidden />
                    </div>
                    {twoVariants && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 px-2 py-1.5">
                        <p className="text-center text-[11px] font-medium text-white">
                          Variante {idx + 1}
                        </p>
                      </div>
                    )}
                  </button>
                  {twoVariants && (
                    <button
                      type="button"
                      onClick={() => setSelected(idx as 0 | 1)}
                      className={`flex min-h-[2.75rem] items-center justify-center gap-1.5 px-2 py-2 text-center text-xs font-medium transition-colors ${
                        selected === idx
                          ? "bg-orange-500/20 text-orange-200"
                          : "bg-zinc-900/60 text-zinc-300 hover:bg-zinc-900"
                      }`}
                    >
                      {selected === idx ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Für Post gewählt
                        </>
                      ) : (
                        "Für Post auswählen"
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!twoVariants && (
              <button
                type="button"
                onClick={() => void handleRequestSecondVariant()}
                disabled={secondVariantBusy || isPosting || discardBusy || downloadBusy}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-800/50 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-orange-500/50 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {secondVariantBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Zweite Variante wird erstellt…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-orange-400" />
                    Zweite Variante mit KI erzeugen
                  </>
                )}
              </button>
            )}

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption hinzufügen (optional)..."
              rows={2}
              className="mb-2 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500"
            />
          </div>

          <div className="shrink-0 space-y-2 border-t border-zinc-800 bg-zinc-900/98 px-4 pt-3 backdrop-blur-md pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={
                  downloadBusy ||
                  isPosting ||
                  secondVariantBusy ||
                  discardBusy
                }
                title={
                  twoVariants
                    ? "Beide Varianten herunterladen"
                    : "Bild herunterladen"
                }
                className="inline-flex min-h-[3rem] flex-1 min-w-[43%] items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {downloadBusy ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 shrink-0" />
                )}
                {downloadBusy ? "Download läuft…" : "Download"}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={
                  !canPost || isPosting || secondVariantBusy || discardBusy || downloadBusy
                }
                className="inline-flex min-h-[3rem] flex-[1_1_100%] items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-[2] sm:min-w-0 sm:flex-nowrap"
              >
                <Send className="h-4 w-4 shrink-0" />
                {isPosting ? "Wird gepostet..." : "Posten"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                void onDiscard();
              }}
              disabled={
                isPosting || secondVariantBusy || discardBusy || downloadBusy
              }
              className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-red-950/70 bg-red-950/25 py-3 text-sm font-medium text-red-300/95 transition-colors hover:border-red-500/50 hover:bg-red-950/45 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {discardBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Wird verworfen…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Verwerfen
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {lightboxUrl ? (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/92 p-4 backdrop-blur-md"
          role="presentation"
        >
          <div className="flex shrink-0 justify-end">
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              aria-label="Schließen"
              className="rounded-full p-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-7 w-7" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Meme groß"
              className="max-h-[min(88dvh,920px)] max-w-full object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
