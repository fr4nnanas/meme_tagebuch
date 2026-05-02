"use client";

import { useCallback, useState } from "react";
import {
  Check,
  Download,
  Loader2,
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

  const twoVariants = variantUrls.length >= 2;

  const handleDownloadSelected = useCallback(async () => {
    const idx = twoVariants ? selected : 0;
    if (idx === null || idx === undefined) return;
    const url = variantUrls[idx];
    if (!url) return;

    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download =
        variantUrls.length >= 2
          ? `meme_variante_${idx + 1}.jpg`
          : `meme.jpg`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Download fehlgeschlagen");
    }
  }, [selected, twoVariants, variantUrls]);

  const handleDownloadOther = useCallback(async () => {
    if (!twoVariants || selected === null) return;
    const otherIndex = selected === 0 ? 1 : 0;
    const url = variantUrls[otherIndex];

    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `meme_variante_${otherIndex + 1}.jpg`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Download fehlgeschlagen");
    }
  }, [selected, twoVariants, variantUrls]);

  const handleRequestSecondVariant = useCallback(async () => {
    setSecondVariantBusy(true);
    try {
      const res = await requestSecondAiMemeVariant(jobId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const statusRes = await fetch(`/api/meme/job-status/${jobId}`);
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
      setSelected(null);
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

  const canDownloadChosen =
    variantUrls.length === 1 ||
    (twoVariants && selected !== null);

  return (
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
            Wähle dein Meme
          </h2>
          <button
            type="button"
            onClick={() => {
              void onDiscard();
            }}
            aria-label="Entwurf verwerfen"
            disabled={discardBusy || isPosting || secondVariantBusy}
            className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-40"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {twoVariants ? (
            <p className="mb-4 text-sm text-zinc-400">
              Tippe auf die Variante, die du posten möchtest.
            </p>
          ) : (
            <p className="mb-4 text-sm text-zinc-400">
              So sieht dein KI-Meme aus. Speichern, posten oder den Entwurf
              unten verwerfen – die Schaltflächen bleiben beim Scrollen sichtbar.
            </p>
          )}

          <div
            className={`mb-4 grid gap-3 ${
              twoVariants ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            {variantUrls.map((url, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => (twoVariants ? setSelected(idx as 0 | 1) : undefined)}
                disabled={!twoVariants}
                className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                  !twoVariants
                    ? "border-zinc-700"
                    : selected === idx
                      ? "border-orange-500 ring-2 ring-orange-500/30"
                      : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Variante ${idx + 1}`}
                  className="aspect-[2/3] w-full object-cover"
                />
                {twoVariants && selected === idx && (
                  <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
                {twoVariants && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 p-2">
                    <p className="text-xs font-medium text-white">
                      Variante {idx + 1}
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>

          {!twoVariants && (
            <button
              type="button"
              onClick={() => void handleRequestSecondVariant()}
              disabled={secondVariantBusy || isPosting || discardBusy}
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
              onClick={() => void handleDownloadSelected()}
              disabled={
                !canDownloadChosen ||
                isPosting ||
                secondVariantBusy ||
                discardBusy
              }
              title={
                twoVariants && selected === null
                  ? "Zuerst eine Variante auswählen"
                  : "Gewähltes Bild laden"
              }
              className="inline-flex min-h-[3rem] flex-1 min-w-[43%] items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4 shrink-0" />
              Laden
            </button>
            {twoVariants && selected !== null ? (
              <button
                type="button"
                onClick={() => void handleDownloadOther()}
                disabled={isPosting || secondVariantBusy || discardBusy}
                className="inline-flex min-h-[3rem] flex-1 min-w-[43%] items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 disabled:opacity-40"
              >
                <Download className="h-4 w-4 shrink-0 opacity-70" />
                Andere laden
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={
                !canPost || isPosting || secondVariantBusy || discardBusy
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
              isPosting || secondVariantBusy || discardBusy
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
  );
}
