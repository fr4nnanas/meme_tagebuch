"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { UserAvatarLightbox } from "@/components/shared/user-avatar-lightbox";
import {
  fetchOverallMemeScoreboardForMyProjectsAction,
  fetchProjectMemeScoreboardAction,
  type MemeScoreRow,
} from "@/lib/actions/stats";

type Tab = "project" | "overall";

function medalForRank(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

interface FeedMemeScoreboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string | null;
}

export function FeedMemeScoreboardDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: FeedMemeScoreboardDialogProps) {
  const [tab, setTab] = useState<Tab>("project");
  const [projectRows, setProjectRows] = useState<MemeScoreRow[]>([]);
  const [overallRows, setOverallRows] = useState<MemeScoreRow[]>([]);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const [pRes, oRes] = await Promise.all([
        fetchProjectMemeScoreboardAction(projectId),
        fetchOverallMemeScoreboardForMyProjectsAction(),
      ]);
      if (pRes.error) {
        toast.error(pRes.error);
        setProjectRows([]);
      } else {
        setProjectRows(pRes.rows);
      }
      if (oRes.error) {
        toast.error(oRes.error);
        setOverallRows([]);
      } else {
        setOverallRows(oRes.rows);
      }
    });
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  if (!open) return null;

  function renderTable(rows: MemeScoreRow[], emptyHint: string) {
    if (isPending && rows.length === 0) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-zinc-500">{emptyHint}</p>
      );
    }
    return (
      <div className="max-h-[min(52vh,420px)] overflow-y-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-[1] bg-zinc-900">
            <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2.5 font-semibold">#</th>
              <th className="px-3 py-2.5 font-semibold">Person</th>
              <th className="px-3 py-2.5 text-right font-semibold">Memes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.user_id}
                className="border-b border-zinc-800/80 last:border-0"
              >
                <td className="w-12 px-3 py-2.5 text-center tabular-nums text-zinc-300">
                  <span title={`Platz ${r.rank}`}>{medalForRank(r.rank)}</span>
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/profile/${r.user_id}`}
                    className="flex min-w-0 items-center gap-2.5 rounded-lg py-0.5 pr-1 transition-colors hover:bg-zinc-800/80"
                    onClick={() => onOpenChange(false)}
                  >
                    <UserAvatarLightbox
                      avatarUrl={r.avatar_url}
                      username={r.username}
                      sizeClassName="h-8 w-8"
                    />
                    <span className="truncate font-medium text-zinc-100">
                      {r.username}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium text-zinc-200">
                  {r.meme_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        aria-label="Dialog schließen"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scoreboard-title"
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(90vh,640px)] w-[min(100vw-24px,400px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 id="scoreboard-title" className="text-lg font-bold text-zinc-100">
            Meme-Ranglisten
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-zinc-800 px-2 pt-2">
          <button
            type="button"
            onClick={() => setTab("project")}
            className={`flex-1 rounded-t-lg px-2 py-2.5 text-center text-xs font-semibold transition-colors ${
              tab === "project"
                ? "bg-zinc-800 text-orange-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {projectName ? `Projekt: ${projectName}` : "Aktuelles Projekt"}
          </button>
          <button
            type="button"
            onClick={() => setTab("overall")}
            className={`flex-1 rounded-t-lg px-2 py-2.5 text-center text-xs font-semibold transition-colors ${
              tab === "overall"
                ? "bg-zinc-800 text-orange-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Gesamt (meine Projekte)
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-xs leading-relaxed text-zinc-500">
            {tab === "project"
              ? "Veröffentlichte Memes pro Person nur in diesem Projekt."
              : "Alle Memes in Projekten, in denen du Mitglied bist – über alle diese Projekte summiert."}
          </p>
          {tab === "project"
            ? renderTable(
                projectRows,
                "Noch keine Memes in diesem Projekt – oder keine Daten.",
              )
            : renderTable(
                overallRows,
                "Keine Memes in deinen Projekten oder keine Daten.",
              )}
        </div>
      </div>
    </>
  );
}
