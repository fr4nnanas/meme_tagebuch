"use client";

import { useState, useTransition } from "react";
import { Archive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchProjectExportDataAction } from "@/lib/actions/export";
import { runProjectZipExport } from "@/lib/export/run-project-zip-export";

interface ProjectExportButtonProps {
  projectId: string;
  projectName: string;
  /** Kleinere Darstellung z. B. im Feed-Header */
  compact?: boolean;
}

export function ProjectExportButton({
  projectId,
  projectName,
  compact = false,
}: ProjectExportButtonProps) {
  const [progress, setProgress] = useState(0);
  const [isExporting, startExport] = useTransition();

  function handleExport() {
    startExport(async () => {
      setProgress(0);
      const { payload, error } = await fetchProjectExportDataAction(projectId);
      if (error || !payload) {
        toast.error(error ?? "Export nicht möglich");
        return;
      }

      const zipResult = await runProjectZipExport(payload, setProgress);
      if (zipResult.error) {
        toast.error(zipResult.error);
        setProgress(0);
        return;
      }

      toast.success("ZIP wurde heruntergeladen.");
      setProgress(0);
    });
  }

  const label = compact ? "ZIP" : "Als ZIP exportieren";

  return (
    <div className={compact ? "flex flex-col gap-1 items-end" : "space-y-2"}>
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        title={`${projectName}: Offline-ZIP (HTML, Bilder, JSON)`}
        className={
          compact
            ? "flex h-10 items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-orange-500 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            : "flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-orange-500 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <Archive className="h-4 w-4 shrink-0" />
        )}
        <span>{isExporting ? "Export…" : label}</span>
      </button>
      {isExporting && (
        <div
          className={
            compact ? "w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden" : "w-full h-2 rounded-full bg-zinc-800 overflow-hidden"
          }
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-orange-500 transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
