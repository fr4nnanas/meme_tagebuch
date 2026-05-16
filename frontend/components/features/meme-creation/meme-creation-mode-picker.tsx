"use client";

import { FlaskConical, PenLine, Sparkles, Wand2 } from "lucide-react";
import type { PostingMode } from "@/lib/meme/meme-creation-types";

export interface AiQuotaDisplay {
  globalLimit: number;
  globalUsed: number;
  projectLimit: number;
  projectUsed: number;
  remainingEffective: number;
}

interface MemeCreationModePickerProps {
  introText: string;
  aiQuota: AiQuotaDisplay | null;
  onSelectMode: (mode: PostingMode) => void;
}

export function MemeCreationModePicker({
  introText,
  aiQuota,
  onSelectMode,
}: MemeCreationModePickerProps) {
  const remainingAi =
    aiQuota != null ? aiQuota.remainingEffective : null;
  const isAiLimitReached =
    aiQuota != null && aiQuota.remainingEffective <= 0;
  const quotaHint =
    aiQuota != null ? (
      <span className="block text-[11px] font-normal leading-snug text-zinc-500/95">
        Global {aiQuota.globalUsed}/{aiQuota.globalLimit} · Projekt{" "}
        {aiQuota.projectUsed}/{aiQuota.projectLimit}
      </span>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-zinc-300">{introText}</p>

      <button
        type="button"
        onClick={() => onSelectMode("ai_full")}
        disabled={isAiLimitReached}
        className={`flex flex-col items-start gap-3 rounded-2xl border-2 p-5 text-left transition-all ${
          isAiLimitReached
            ? "cursor-not-allowed border-zinc-700/80 bg-zinc-900/50 opacity-60"
            : "border-emerald-600/55 bg-emerald-950/35 hover:border-emerald-500 hover:bg-emerald-950/55"
        }`}
      >
        <div className="flex w-full gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              isAiLimitReached ? "bg-zinc-800" : "bg-emerald-500/20"
            }`}
          >
            <Sparkles
              className={`h-6 w-6 ${
                isAiLimitReached ? "text-zinc-500" : "text-emerald-400"
              }`}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-base font-semibold text-zinc-100">
              Neues Meme von der KI
            </p>
            <p className="text-sm leading-relaxed text-zinc-400">
              Die KI generiert ein komplett neues Meme-Bild passend zu deiner
              Idee.
            </p>
          </div>
        </div>
        {isAiLimitReached ? (
          <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400">
            Tageslimit erreicht
          </span>
        ) : remainingAi !== null && aiQuota != null ? (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300/90">
            Heute noch {remainingAi} KI-Bilder frei (effektives Minimum)
            {quotaHint}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-950/60 px-2.5 py-1 text-xs text-emerald-400/80">
            Kontingent wird geladen…
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onSelectMode("text_overlay")}
        className="flex flex-col items-start gap-3 rounded-2xl border-2 border-orange-600/55 bg-orange-950/35 p-5 text-left transition-all hover:border-orange-500 hover:bg-orange-950/55"
      >
        <ModeOptionRow
          icon={<Wand2 className="h-6 w-6 text-orange-400" />}
          iconBg="bg-orange-500/20"
          title="Text auf mein Foto"
          description="Dein Foto bleibt erhalten. Die KI erstellt Schrift und platziert diese auf dem Bild."
        />
        <span className="rounded-full bg-orange-500/20 px-2.5 py-1 text-xs font-medium text-orange-300">
          Unlimitiert
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSelectMode("fully_manual")}
        className="flex flex-col items-start gap-3 rounded-2xl border-2 border-red-600/55 bg-red-950/35 p-5 text-left transition-all hover:border-red-500 hover:bg-red-950/55"
      >
        <ModeOptionRow
          icon={<PenLine className="h-6 w-6 text-red-400" />}
          iconBg="bg-red-500/20"
          title="Alles selbst"
          description="Du schreibst den Text selbst und legst ihn auf das Bild – ohne KI."
        />
        <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-300">
          Unlimitiert
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSelectMode("ai_experiment")}
        disabled={isAiLimitReached}
        className={`flex flex-col items-start gap-2 rounded-xl border-2 p-3.5 text-left transition-all ${
          isAiLimitReached
            ? "cursor-not-allowed border-zinc-700/80 bg-zinc-900/50 opacity-60"
            : "border-cyan-600/55 bg-cyan-950/35 hover:border-cyan-500 hover:bg-cyan-950/55"
        }`}
      >
        <div className="flex w-full gap-2.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            isAiLimitReached ? "bg-zinc-800" : "bg-cyan-500/20"
          }`}
        >
          <FlaskConical
            className={`h-5 w-5 ${
              isAiLimitReached ? "text-zinc-500" : "text-cyan-400"
            }`}
          />
        </div>
          <ModeOptionRow
            icon={null}
            iconBg=""
            title="KI experimentell"
            description="Hier experimentiert Franz mit dem Meme-Engine herum."
            compact
          />
        </div>
        {isAiLimitReached ? (
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-400">
            Tageslimit erreicht
          </span>
        ) : remainingAi !== null && aiQuota != null ? (
          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] text-cyan-300/90">
            Wie KI-Vollbild: noch {remainingAi} frei
            {quotaHint}
          </span>
        ) : (
          <span className="rounded-full bg-cyan-950/60 px-2 py-0.5 text-[11px] text-cyan-400/80">
            Kontingent wird geladen…
          </span>
        )}
      </button>
    </div>
  );
}

function ModeOptionRow({
  icon,
  iconBg,
  title,
  description,
  compact = false,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-100">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-zinc-400">
          {description}
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full gap-3">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-base font-semibold text-zinc-100">{title}</p>
        <p className="text-sm leading-relaxed text-zinc-400">{description}</p>
      </div>
    </div>
  );
}
