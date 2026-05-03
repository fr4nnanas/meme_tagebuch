"use client";

import { useState, useTransition } from "react";
import { Archive, Link2, Loader2, Share2 } from "lucide-react";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { fetchProjectExportDataAction } from "@/lib/actions/export";
import { buildProjectZipBlob } from "@/lib/export/run-project-zip-export";
import { shareProjectAlbumLink, shareZipFile } from "@/lib/share/web-share";

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
  const [isSharing, startShare] = useTransition();
  const [isLinkShare, startLinkShare] = useTransition();

  function handleDownloadZip() {
    startExport(async () => {
      setProgress(0);
      const { payload, error } = await fetchProjectExportDataAction(projectId);
      if (error || !payload) {
        toast.error(error ?? "Export nicht möglich");
        return;
      }

      const result = await buildProjectZipBlob(payload, setProgress);
      if ("error" in result) {
        toast.error(result.error);
        setProgress(0);
        return;
      }

      saveAs(result.blob, result.filename);
      setProgress(0);
      toast.success("ZIP wurde heruntergeladen.");
    });
  }

  function handleShareZip() {
    startShare(async () => {
      setProgress(0);
      const { payload, error } = await fetchProjectExportDataAction(projectId);
      if (error || !payload) {
        toast.error(error ?? "Export nicht möglich");
        return;
      }

      const result = await buildProjectZipBlob(payload, setProgress);
      if ("error" in result) {
        toast.error(result.error);
        setProgress(0);
        return;
      }

      const mode = await shareZipFile({
        blob: result.blob,
        filename: result.filename,
        projectName: projectName,
      });
      setProgress(0);

      if (mode === "cancelled") return;
      if (mode === "download") {
        saveAs(result.blob, result.filename);
        toast.success("Kein Datei-Teilen verfügbar — ZIP wurde heruntergeladen.");
        return;
      }
      if (mode === "shared-text") {
        toast.message(
          "Nur Text geteilt. ZIP bei Bedarf über „Herunterladen“ speichern.",
        );
        return;
      }
      toast.success("ZIP über das System geteilt.");
    });
  }

  function handleShareProjectLink() {
    startLinkShare(async () => {
      const outcome = await shareProjectAlbumLink(projectName, projectId);
      if (outcome === "cancelled") return;
      if (outcome === "shared") {
        toast.success("Projekt-Link geteilt.");
        return;
      }
      if (outcome === "clipboard") {
        toast.success("Link in die Zwischenablage kopiert.");
        return;
      }
      toast.error("Teilen nicht möglich.");
    });
  }

  const busy = isExporting || isSharing;
  const label = compact ? "ZIP" : "Herunterladen";
  const shareZipLabel = compact ? "Teilen" : "ZIP teilen";
  const linkLabel = compact ? "Link" : "Projekt-Link teilen";

  return (
    <div className={compact ? "flex flex-col gap-1 items-end" : "space-y-3"}>
      <div
        className={
          compact
            ? "flex flex-col items-end gap-1.5"
            : "flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        }
      >
        <button
          type="button"
          onClick={handleDownloadZip}
          disabled={busy || isLinkShare}
          title={`${projectName}: ZIP speichern (HTML, Bilder, JSON)`}
          className={
            compact
              ? "flex h-10 items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-orange-500 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              : "flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-orange-500 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Archive className="h-4 w-4 shrink-0" />
          )}
          <span>{isExporting ? "Erstelle…" : label}</span>
        </button>

        <button
          type="button"
          onClick={handleShareZip}
          disabled={busy || isLinkShare}
          title="ZIP per System-Dialog teilen (z. B. AirDrop, Drive)"
          className={
            compact
              ? "flex h-10 items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/80 px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-orange-500 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              : "flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-orange-500 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          {isSharing ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4 shrink-0" />
          )}
          <span>{isSharing ? "Teilen…" : shareZipLabel}</span>
        </button>

        <button
          type="button"
          onClick={handleShareProjectLink}
          disabled={busy || isLinkShare}
          title="Link zum Feed dieses Projekts (öffnet bei Mitgliedern dasselbe Projekt)"
          className={
            compact
              ? "flex h-10 items-center gap-1.5 rounded-full border border-zinc-600 bg-transparent px-3 text-xs font-medium text-zinc-400 transition-colors hover:border-orange-500 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              : "flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-transparent px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-orange-500 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          {isLinkShare ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4 shrink-0" />
          )}
          <span>{isLinkShare ? "…" : linkLabel}</span>
        </button>
      </div>

      {busy && (
        <div
          className={
            compact
              ? "w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden"
              : "w-full h-2 rounded-full bg-zinc-800 overflow-hidden"
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
