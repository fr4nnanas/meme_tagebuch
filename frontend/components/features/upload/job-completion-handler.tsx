"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useJobContext } from "@/components/features/app/job-context";
import { VariantPickerModal } from "@/components/features/upload/variant-picker-modal";
import { CanvasMemePreview } from "@/components/features/upload/canvas-meme-preview";
import {
  finalizePost,
  deleteVariant,
  discardUnpublishedMeme,
  uploadCanvasPublishedMemeAction,
} from "@/lib/actions/upload";
import { memePublishedObjectKey } from "@/lib/storage/r2-url";
import { createClient } from "@/lib/supabase/client";

// Dieser Wrapper wird im App-Layout gemountet und reagiert auf abgeschlossene Jobs.
export function JobCompletionHandler() {
  const { completedJobData, completionUiOpen, closeCompletionUi, clearJob } =
    useJobContext();
  const router = useRouter();
  const [isPosting, setIsPosting] = useState(false);
  const [discardBusy, setDiscardBusy] = useState(false);

  const handleDiscardDraft = useCallback(async () => {
    if (!completedJobData?.postId) return;
    if (
      !window.confirm(
        "Erstellungsentwurf wirklich verwerfen? Das Bild und etwaige KI-Varianten werden aus dem Projekt gelöscht.",
      )
    )
      return;

    setDiscardBusy(true);
    try {
      const result = await discardUnpublishedMeme(completedJobData.postId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Entwurf wurde verworfen");
      clearJob();
      router.refresh();
    } finally {
      setDiscardBusy(false);
    }
  }, [completedJobData?.postId, clearJob, router]);

  const handleAiVariantConfirm = useCallback(
    async (
      chosenPath: string,
      discardedPath: string | null,
      caption: string,
    ) => {
      if (!completedJobData?.postId) return;
      setIsPosting(true);

      try {
        const result = await finalizePost(
          completedJobData.postId,
          chosenPath,
          caption || undefined,
        );

        if (result.error) {
          toast.error(`Fehler: ${result.error}`);
          return;
        }

        if (discardedPath) {
          await deleteVariant(discardedPath);
        }

        toast.success("Meme wurde gepostet! 🎉");
        clearJob();
        router.push("/feed");
        router.refresh();
      } catch {
        toast.error("Fehler beim Posten");
      } finally {
        setIsPosting(false);
      }
    },
    [completedJobData, clearJob, router],
  );

  const handleCanvasPost = useCallback(
    async (memeBlob: Blob, caption: string) => {
      if (!completedJobData?.postId) return;
      setIsPosting(true);

      try {
        const fd = new FormData();
        fd.set("meme", new File([memeBlob], "meme.jpg", { type: "image/jpeg" }));
        const up = await uploadCanvasPublishedMemeAction(
          completedJobData.postId,
          fd,
        );
        if (up.error) {
          toast.error(up.error);
          return;
        }

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Nicht angemeldet");
          return;
        }
        const { data: post } = await supabase
          .from("posts")
          .select("project_id")
          .eq("id", completedJobData.postId)
          .maybeSingle();

        if (!post?.project_id) {
          toast.error("Post nicht gefunden");
          return;
        }

        const memePath = memePublishedObjectKey(
          post.project_id,
          user.id,
          completedJobData.postId,
        );

        const result = await finalizePost(
          completedJobData.postId,
          memePath,
          caption || undefined,
        );

        if (result.error) {
          toast.error(`Fehler: ${result.error}`);
          return;
        }

        toast.success("Meme wurde gepostet! 🎉");
        clearJob();
        router.push("/feed");
        router.refresh();
      } catch {
        toast.error("Fehler beim Posten");
      } finally {
        setIsPosting(false);
      }
    },
    [completedJobData, clearJob, router],
  );

  // Kein abgeschlossener Job oder Abschluss-UI nicht geöffnet
  if (!completedJobData || !completionUiOpen) return null;

  // Typ A: Varianten-Auswahl
  if (completedJobData.memeType === "ai_generated" && completedJobData.variantSignedUrls) {
    const variantPaths = completedJobData.variantPaths ?? [];

    return (
      <VariantPickerModal
        jobId={completedJobData.id}
        variantUrls={completedJobData.variantSignedUrls}
        variantPaths={variantPaths}
        postId={completedJobData.postId ?? ""}
        onConfirm={(chosen, discarded, caption) =>
          void handleAiVariantConfirm(chosen, discarded, caption)
        }
        onDiscard={() => void handleDiscardDraft()}
        onMinimize={closeCompletionUi}
        discardBusy={discardBusy}
        isPosting={isPosting}
      />
    );
  }

  // Typ B: Canvas-Vorschau
  if (
    completedJobData.memeType === "canvas_overlay" &&
    completedJobData.originalSignedUrl &&
    (completedJobData.overlayTextTop?.trim() ||
      completedJobData.overlayTextBottom?.trim())
  ) {
    return (
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-labelledby="canvas-preview-title"
          className="flex h-[min(92dvh,calc(100dvh-env(safe-area-inset-bottom,0px)))] max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-zinc-800 bg-zinc-800 shadow-xl sm:max-h-[min(88vh,800px)] sm:rounded-2xl"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
            <h2 id="canvas-preview-title" className="text-lg font-semibold text-zinc-100">
              Meme fertig
            </h2>
            <button
              type="button"
              aria-label="Vorschau schließen"
              disabled={discardBusy || isPosting}
              onClick={closeCompletionUi}
              className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-40"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-2 pt-2">
            <CanvasMemePreview
              originalImageUrl={completedJobData.originalSignedUrl}
              overlayTextTop={completedJobData.overlayTextTop ?? null}
              overlayTextBottom={completedJobData.overlayTextBottom ?? ""}
              onPost={(blob, caption) => void handleCanvasPost(blob, caption)}
              onDiscard={() => void handleDiscardDraft()}
              isPosting={isPosting}
              discardBusy={discardBusy}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
