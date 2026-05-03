"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronUp, MessageSquareText } from "lucide-react";
import {
  hasPipelinePromptContent,
  summarizePipelinePrompt,
} from "@/lib/meme/prompt-display";

interface MemePromptDisclosureProps {
  pipelineInputText: string | null;
  className?: string;
}

export function MemePromptDisclosure({
  pipelineInputText,
  className = "",
}: MemePromptDisclosureProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  if (!hasPipelinePromptContent(pipelineInputText)) return null;

  const full = pipelineInputText!.replace(/\s+/g, " ").trim();
  const summary = summarizePipelinePrompt(full);
  const needsToggle = full.length > summary.length || full !== summary;

  if (!needsToggle) {
    return (
      <div
        className={`flex gap-2 border-t border-zinc-700/80 bg-zinc-900/40 px-4 py-2.5 ${className}`}
      >
        <MessageSquareText
          className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500"
          aria-hidden
        />
        <p className="min-w-0 text-xs leading-relaxed text-zinc-400">
          <span className="font-medium text-zinc-500">Erzeugung: </span>
          {full}
        </p>
      </div>
    );
  }

  return (
    <div className={`border-t border-zinc-700/80 bg-zinc-900/40 ${className}`}>
      <button
        type="button"
        id={`${id}-btn`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 px-4 py-2.5 text-left transition-colors hover:bg-zinc-800/50"
      >
        <MessageSquareText
          className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500"
          aria-hidden
        />
        <span className="min-w-0 flex-1 text-xs leading-relaxed text-zinc-400">
          <span className="font-medium text-zinc-500">Erzeugung: </span>
          {summary}
        </span>
        {open ? (
          <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        ) : (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        )}
      </button>
      {open ? (
        <div
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-btn`}
          className="border-t border-zinc-800/90 px-4 pb-3 pt-0"
        >
          <p className="pl-6 text-xs leading-relaxed text-zinc-300">{full}</p>
        </div>
      ) : null}
    </div>
  );
}
