"use client";

import { useState, useTransition } from "react";
import { Save, Zap } from "lucide-react";
import { toast } from "sonner";
import { updateAiLimit } from "@/lib/actions/admin";

interface AiLimitSectionProps {
  currentLimit: number;
}

export function AiLimitSection({ currentLimit }: AiLimitSectionProps) {
  const [value, setValue] = useState(String(currentLimit));
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
      toast.error("Limit muss eine ganze Zahl zwischen 1 und 100 sein.");
      return;
    }

    startTransition(async () => {
      const result = await updateAiLimit(parsed);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`KI-Limit auf ${parsed} gesetzt.`);
      }
    });
  }

  const numericValue = parseInt(value, 10);
  const isValid =
    !isNaN(numericValue) && numericValue >= 1 && numericValue <= 100;
  const hasChanged = numericValue !== currentLimit;

  return (
    <div className="space-y-4">
      {/* Header */}
      <h2 className="text-base font-semibold text-zinc-100">KI-Limit</h2>

      {/* Erklärungsbox */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 flex gap-3">
        <Zap className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-zinc-200">
            Tägliche KI-Bild-Generierungen
          </p>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Legt fest, wie viele KI-Vollbilder (Typ A) jeder User pro Tag
            generieren darf. Gilt für alle User. Aktuell:{" "}
            <span className="text-orange-400 font-semibold">
              {currentLimit}
            </span>{" "}
            pro Tag.
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-4 space-y-3">
        <label
          htmlFor="ai-limit-input"
          className="block text-sm font-medium text-zinc-300"
        >
          Neues Limit (1–100)
        </label>
        <div className="flex gap-3">
          <input
            id="ai-limit-input"
            type="number"
            min={1}
            max={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={handleSave}
            disabled={!isValid || !hasChanged || isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="h-4 w-4" />
            {isPending ? "Speichern…" : "Speichern"}
          </button>
        </div>

        {/* Schnellauswahl */}
        <div>
          <p className="text-xs text-zinc-500 mb-2">Schnellauswahl:</p>
          <div className="flex gap-2 flex-wrap">
            {[1, 3, 5, 10, 20].map((preset) => (
              <button
                key={preset}
                onClick={() => setValue(String(preset))}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  numericValue === preset
                    ? "bg-orange-500 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
              >
                {preset}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
