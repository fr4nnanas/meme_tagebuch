"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { FolderInput, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  fetchDestinationProjectsForMoveAction,
  movePostToProjectAction,
  type MovePostProjectOption,
} from "@/lib/actions/feed";

interface MovePostProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  currentProjectId: string;
  onMoved: () => void;
}

export function MovePostProjectDialog({
  open,
  onOpenChange,
  postId,
  currentProjectId,
  onMoved,
}: MovePostProjectDialogProps) {
  const [projects, setProjects] = useState<MovePostProjectOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [, startMove] = useTransition();

  const loadTargets = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetchDestinationProjectsForMoveAction(currentProjectId);
      if (res.error) {
        toast.error(res.error);
        setProjects([]);
        return;
      }
      setProjects(res.projects);
    } finally {
      setLoadingList(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (!open) return;
    void loadTargets();
  }, [open, loadTargets]);

  function handlePick(targetId: string) {
    startMove(async () => {
      setMovingId(targetId);
      const res = await movePostToProjectAction(postId, targetId);
      setMovingId(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Meme wurde verschoben.");
      onOpenChange(false);
      onMoved();
    });
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        aria-label="Dialog schließen"
        onClick={() => !movingId && onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-post-title"
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(85vh,480px)] w-[min(100vw-24px,380px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <FolderInput className="h-5 w-5 text-orange-400" />
            <h2 id="move-post-title" className="text-base font-bold text-zinc-100">
              In anderes Projekt
            </h2>
          </div>
          <button
            type="button"
            disabled={Boolean(movingId)}
            onClick={() => onOpenChange(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loadingList ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
          ) : projects.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-zinc-500">
              Kein anderes Projekt verfügbar, in das du verschieben kannst.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={Boolean(movingId)}
                    onClick={() => handlePick(p.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="min-w-0 truncate">{p.name}</span>
                    {movingId === p.id ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-orange-400" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
