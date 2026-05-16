"use client";

import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import {
  EXPERIMENTAL_MEME_ART_STYLES,
  EXPERIMENTAL_NAMED_MASTER_PROMPTS,
  EXPERIMENTAL_STYLIZATION_STYLES,
  ROTATING_EXPERIMENTAL_KEY,
} from "@/lib/meme/ai-meme-master-styles";
import {
  MODE_LABEL,
  toPipeline,
  type PostingMode,
} from "@/lib/meme/meme-creation-types";
import { HorizontalSnapScroller } from "@/components/shared/horizontal-snap-scroller";

interface PreviewSlide {
  key: string;
  src: string;
  alt: string;
  label: string;
  overlay?: React.ReactNode;
}

interface MemeCreationConfigurePanelProps {
  postingMode: PostingMode;
  previewSlides: PreviewSlide[];
  banner?: React.ReactNode;
  backLabel?: string;
  onBack: () => void;
  userText: string;
  onUserTextChange: (value: string) => void;
  selectedCaption: string | null;
  onToggleCaption: (idea: string) => void;
  captions: string[];
  isLoadingCaptions: boolean;
  onGenerateCaptions: () => void;
  experimentMemeArtKey: string;
  onExperimentMemeArtKeyChange: (value: string) => void;
  experimentMasterChoice: string;
  onExperimentMasterChoiceChange: (value: string) => void;
  experimentStylizationKey: string;
  onExperimentStylizationKeyChange: (value: string) => void;
  experimentMinimalLayout: boolean;
  onExperimentMinimalLayoutChange: (value: boolean) => void;
  isAiLimitReached: boolean;
  submitLabel?: string;
  onSubmit: () => void;
}

export function MemeCreationConfigurePanel({
  postingMode,
  previewSlides,
  banner,
  backLabel = "Andere Variante wählen",
  onBack,
  userText,
  onUserTextChange,
  selectedCaption,
  onToggleCaption,
  captions,
  isLoadingCaptions,
  onGenerateCaptions,
  experimentMemeArtKey,
  onExperimentMemeArtKeyChange,
  experimentMasterChoice,
  onExperimentMasterChoiceChange,
  experimentStylizationKey,
  onExperimentStylizationKeyChange,
  experimentMinimalLayout,
  onExperimentMinimalLayoutChange,
  isAiLimitReached,
  submitLabel = "Meme erstellen ✨",
  onSubmit,
}: MemeCreationConfigurePanelProps) {
  const pipeline = toPipeline(postingMode, selectedCaption);
  const showIdeasSection = postingMode !== "fully_manual";
  const hintsLocked = selectedCaption !== null;

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </button>

      {banner}

      {previewSlides.length > 0 && (
        <PreviewStrip slides={previewSlides} />
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-800/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Gewählt
        </p>
        <p className="mt-1 text-sm font-medium text-zinc-200">
          {MODE_LABEL[postingMode]}
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {postingMode === "fully_manual"
            ? "Dein Meme-Text"
            : "Idee / Stichworte (optional)"}
        </p>
        {postingMode === "fully_manual" ? (
          <>
            <p className="mb-2 text-xs text-zinc-500">
              Wird unverändert aufs Bild gelegt. Eine Zeile = nur unten. Ab dem
              ersten Zeilenumbruch: Text oben / Text unten.
            </p>
            <textarea
              value={userText}
              onChange={(e) => onUserTextChange(e.target.value)}
              rows={5}
              placeholder={
                "Nur unten: einfach hier tippen\n\nOder:\nZeile oben\nZeile(n) unten"
              }
              className="w-full rounded-xl border border-zinc-800 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500"
            />
          </>
        ) : (
          <>
            <p
              className={`mb-2 text-xs ${hintsLocked ? "text-zinc-600" : "text-zinc-500"}`}
            >
              {hintsLocked
                ? "Stichworte werden nach Auswahl einer Idee nicht mehr verwendet. Es gilt nur die ausgewählte Idee."
                : "Optional: Stichworte helfen beim Generieren weiterer Ideen und fließen in die automatische Ausarbeitung ein, solange du noch keine Konkret-Idee angeklickt hast."}
            </p>
            <textarea
              value={userText}
              disabled={hintsLocked}
              readOnly={hintsLocked}
              onChange={(e) => onUserTextChange(e.target.value)}
              rows={4}
              placeholder="z. B. Stichwörter für Stimmung & Kontext oder Insider-Witze"
              className={`w-full resize-y rounded-xl border border-zinc-800 bg-zinc-800 px-4 py-3 text-sm outline-none placeholder-zinc-500 ${
                hintsLocked
                  ? "cursor-not-allowed opacity-55 text-zinc-500 border-zinc-800/80"
                  : "text-zinc-100 focus:border-orange-500"
              }`}
            />
          </>
        )}
      </div>

      {showIdeasSection && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onGenerateCaptions}
            disabled={isLoadingCaptions || hintsLocked}
            className="flex flex-col items-center justify-center gap-0.5 rounded-full bg-zinc-800 px-4 py-3 text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isLoadingCaptions ? (
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                KI denkt nach...
              </span>
            ) : (
              <>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <RefreshCw className="h-4 w-4 shrink-0" />
                  {captions.length > 0
                    ? "Neue Ideen generieren"
                    : "Ideen generieren"}
                </span>
                <span className="text-[11px] font-normal leading-tight text-zinc-500">
                  optional als Inspiration
                </span>
              </>
            )}
          </button>

          {captions.length > 0 && (
            <div className="flex flex-col gap-2">
              {captions.map((idea, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onToggleCaption(idea)}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                    selectedCaption === idea
                      ? "border-orange-500 bg-orange-500/10 text-zinc-100"
                      : hintsLocked && selectedCaption !== idea
                        ? "border-zinc-800/70 bg-zinc-800/50 text-zinc-600 opacity-75 hover:border-zinc-600 hover:text-zinc-400"
                        : "border-zinc-800 bg-zinc-800 text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  {idea}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {postingMode === "ai_experiment" && (
        <div className="space-y-3 rounded-xl border border-cyan-600/35 bg-cyan-950/30 px-3 py-2.5">
          <p className="text-xs leading-snug text-zinc-400">
            Meme-Art und Masterprompt schließen sich aus — wähle jeweils nur eine
            Steuerung. Stilisierung ist optional und kombinierbar.
          </p>
          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-zinc-300"
              htmlFor="experiment-meme-art"
            >
              Meme-Art
            </label>
            <select
              id="experiment-meme-art"
              value={experimentMemeArtKey}
              disabled={experimentMasterChoice !== ROTATING_EXPERIMENTAL_KEY}
              onChange={(e) => {
                const value = e.target.value;
                onExperimentMemeArtKeyChange(value);
                if (value) {
                  onExperimentMasterChoiceChange(ROTATING_EXPERIMENTAL_KEY);
                }
              }}
              className="w-full rounded-lg border border-cyan-800/50 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <option value="">Keine — Masterprompt steuert</option>
              {Object.entries(EXPERIMENTAL_MEME_ART_STYLES).map(
                ([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-zinc-300"
              htmlFor="experiment-master-style"
            >
              Masterprompt
            </label>
            <select
              id="experiment-master-style"
              value={experimentMasterChoice}
              disabled={Boolean(experimentMemeArtKey)}
              onChange={(e) => {
                const value = e.target.value;
                onExperimentMasterChoiceChange(value);
                if (value !== ROTATING_EXPERIMENTAL_KEY) {
                  onExperimentMemeArtKeyChange("");
                }
              }}
              className="w-full rounded-lg border border-cyan-800/50 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <option value={ROTATING_EXPERIMENTAL_KEY}>
                Automatisch wechseln (Rotation je Meme)
              </option>
              {Object.entries(EXPERIMENTAL_NAMED_MASTER_PROMPTS).map(
                ([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-zinc-300"
              htmlFor="experiment-stylization"
            >
              Stilisierung
            </label>
            <select
              id="experiment-stylization"
              value={experimentStylizationKey}
              onChange={(e) =>
                onExperimentStylizationKeyChange(e.target.value)
              }
              className="w-full rounded-lg border border-cyan-800/50 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
            >
              <option value="">Keine zusätzliche Stilisierung</option>
              {Object.entries(EXPERIMENTAL_STYLIZATION_STYLES).map(
                ([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ),
              )}
            </select>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 text-left">
            <input
              type="checkbox"
              checked={experimentMinimalLayout}
              onChange={(e) =>
                onExperimentMinimalLayoutChange(e.target.checked)
              }
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-cyan-700 bg-zinc-900 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-xs leading-snug text-zinc-300">
              Sehr reduzierte Bildelemente (optional) — Fokus auf Text, maximal
              zwei klare Grafikelemente.
            </span>
          </label>
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={
          ((postingMode === "ai_full" || postingMode === "ai_experiment") &&
            isAiLimitReached) ||
          (pipeline === "assisted" &&
            captions.length > 0 &&
            !selectedCaption) ||
          (postingMode === "fully_manual" && !userText.trim())
        }
        className="rounded-full bg-orange-500 py-4 text-base font-semibold text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function PreviewStrip({ slides }: { slides: PreviewSlide[] }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <HorizontalSnapScroller
        slides={slides.map((s) => ({
          key: s.key,
          src: s.src,
          alt: s.alt,
          label: s.label,
          overlay: s.overlay,
        }))}
        showPageBadge
        slideClassName="w-full"
        imgClassName="aspect-[2/3] w-full object-cover"
      />
    </div>
  );
}
