"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import {
  Check,
  Heart,
  Loader2,
  MessageCircle,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchPostDetailAction,
  togglePostLikeAction,
  updatePostCaptionAction,
  type PostWithDetails,
} from "@/lib/actions/feed";
import { CommentSheet } from "@/components/features/feed/comment-sheet";

interface ProfilePostDetailSheetProps {
  postId: string | null;
  /** Thumbnail-/Lightbox-URL für sofortiges Bild während Laden */
  fallbackImageSrc: string | null;
  currentUserId: string;
  onClose: () => void;
}

export function ProfilePostDetailSheet({
  postId,
  fallbackImageSrc,
  currentUserId,
  onClose,
}: ProfilePostDetailSheetProps) {
  const [post, setPost] = useState<PostWithDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [likeState, setLikeState] = useState<{ liked: boolean; count: number }>({
    liked: false,
    count: 0,
  });
  const [optimisticLike, addOptimisticLike] = useOptimistic(
    likeState,
    (_s, next: typeof likeState) => next,
  );

  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [showCaptionEdit, setShowCaptionEdit] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");
  const [currentCaption, setCurrentCaption] = useState<string | null>(null);
  const [isGeneratingCaption, startGenerateCaptionTransition] = useTransition();
  const [isSavingCaption, startSaveCaptionTransition] = useTransition();
  const [isLiking, startLikeTransition] = useTransition();

  useEffect(() => {
    if (!postId) {
      setPost(null);
      setLoadError(null);
      setIsLoadingDetail(false);
      return;
    }

    let cancelled = false;
    setIsLoadingDetail(true);
    setLoadError(null);
    setShowComments(false);
    setShowCaptionEdit(false);

    fetchPostDetailAction(postId)
      .then((result) => {
        if (cancelled) return;
        if (result.error || !result.post) {
          setPost(null);
          setLoadError(result.error ?? "Post nicht gefunden");
          return;
        }
        const p = result.post;
        setPost(p);
        setLikeState({ liked: p.liked_by_me, count: p.like_count });
        setCommentCount(p.comment_count);
        setCaptionDraft(p.caption ?? "");
        setCurrentCaption(p.caption ?? null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  function handleBackdropClose() {
    onClose();
  }

  function handleLike() {
    if (!post || isLiking) return;
    const next = {
      liked: !optimisticLike.liked,
      count: optimisticLike.liked
        ? optimisticLike.count - 1
        : optimisticLike.count + 1,
    };
    startLikeTransition(async () => {
      addOptimisticLike(next);
      const result = await togglePostLikeAction(post.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setLikeState({ liked: result.liked, count: result.like_count });
    });
  }

  function handleGenerateCaption() {
    if (!post?.meme_image_url) return;
    startGenerateCaptionTransition(async () => {
      try {
        const res = await fetch("/api/meme/generate-caption", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: post.id }),
        });
        const data = (await res.json()) as { caption?: string; error?: string };
        if (!res.ok || data.error) {
          toast.error(data.error ?? "Caption-Generierung fehlgeschlagen");
          return;
        }
        setCaptionDraft(data.caption ?? "");
        setShowCaptionEdit(true);
      } catch {
        toast.error("Caption-Generierung fehlgeschlagen");
      }
    });
  }

  function handleSaveCaption() {
    if (!post) return;
    startSaveCaptionTransition(async () => {
      const result = await updatePostCaptionAction(post.id, captionDraft);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const saved = captionDraft.trim() || null;
      setCurrentCaption(saved);
      setCaptionDraft(saved ?? "");
      setShowCaptionEdit(false);
      setPost((prev) => (prev ? { ...prev, caption: saved } : prev));
      toast.success("Caption gespeichert.");
    });
  }

  function handleCancelCaption() {
    setCaptionDraft(currentCaption ?? "");
    setShowCaptionEdit(false);
  }

  if (!postId) return null;

  const isPostOwner = post?.user_id === currentUserId;
  const imgSrc = post?.signed_url ?? fallbackImageSrc;
  const createdAt = post
    ? new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(post.created_at))
    : "";

  return (
    <>
      <div
        className="fixed inset-0 z-[30] bg-black/70 backdrop-blur-sm"
        onClick={handleBackdropClose}
      />

      <div className="fixed inset-0 z-[35] flex flex-col overflow-hidden">
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 border-b border-zinc-800 bg-zinc-950/95 px-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <span className="w-10 shrink-0" aria-hidden />
          <div className="flex min-w-0 justify-center px-2 text-center">
            {post ? (
              <Link
                href={`/profile/${post.user_id}`}
                className="inline-flex max-w-full items-center justify-center gap-2 rounded-xl py-1 outline-none ring-orange-500/40 focus-visible:ring-2"
                onClick={onClose}
              >
                <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-zinc-800">
                  {post.user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.user.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-600">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {post.user.username}
                  </p>
                  <p className="text-xs text-zinc-500">{createdAt}</p>
                </div>
              </Link>
            ) : (
              <span className="text-sm font-medium text-zinc-400">Post</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-10 w-10 items-center justify-center justify-self-end rounded-full text-zinc-300 hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto overscroll-contain bg-zinc-950 pb-[env(safe-area-inset-bottom,12px)]"
          onClick={(e) => e.stopPropagation()}
        >
          {loadError && (
            <p className="px-6 py-8 text-center text-sm text-red-400">{loadError}</p>
          )}

          {!loadError && (
            <>
              <div className="mx-auto aspect-[2/3] w-full max-w-md bg-zinc-900">
                {imgSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgSrc}
                    alt="Meme"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[200px] w-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
                  </div>
                )}
              </div>

              {!isLoadingDetail && post && (
                <>
                  <div className="flex items-center gap-1 border-b border-zinc-800 px-4 py-2">
                    <button
                      type="button"
                      onClick={handleLike}
                      disabled={isLiking}
                      aria-label={optimisticLike.liked ? "Like entfernen" : "Liken"}
                      className="flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed"
                    >
                      <Heart
                        className={`h-6 w-6 transition-colors ${
                          optimisticLike.liked
                            ? "fill-orange-500 text-orange-500"
                            : "text-zinc-400"
                        }`}
                      />
                      <span
                        className={
                          optimisticLike.liked ? "text-orange-400" : "text-zinc-400"
                        }
                      >
                        {optimisticLike.count}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowComments(true)}
                      aria-label="Kommentare anzeigen"
                      className="flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                    >
                      <MessageCircle className="h-6 w-6" />
                      <span>{commentCount}</span>
                    </button>
                  </div>

                  <div className="px-4 pb-6 pt-2">
                    {showCaptionEdit ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={captionDraft}
                          onChange={(e) => setCaptionDraft(e.target.value)}
                          maxLength={500}
                          rows={4}
                          placeholder="Caption schreiben…"
                          className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSaveCaption}
                            disabled={isSavingCaption}
                            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-orange-500 text-sm font-semibold text-white transition-colors hover:bg-orange-400 disabled:opacity-60"
                          >
                            {isSavingCaption ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                            Speichern
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelCaption}
                            aria-label="Abbrechen"
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 hover:text-zinc-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {currentCaption ? (
                          <p className="text-sm leading-relaxed text-zinc-200">
                            <Link
                              href={`/profile/${post.user_id}`}
                              className="font-semibold text-zinc-100 underline-offset-2 hover:text-orange-400 hover:underline"
                            >
                              {post.user.username}
                            </Link>{" "}
                            {currentCaption}
                          </p>
                        ) : (
                          isPostOwner && (
                            <p className="text-xs italic text-zinc-500">Noch keine Caption.</p>
                          )
                        )}

                        {isPostOwner && !showCaptionEdit && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowCaptionEdit(true)}
                              className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-orange-500 hover:text-orange-400"
                            >
                              Caption bearbeiten
                            </button>
                            <button
                              type="button"
                              onClick={handleGenerateCaption}
                              disabled={
                                isGeneratingCaption || !post.meme_image_url
                              }
                              className="flex items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-orange-500 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {isGeneratingCaption ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                              )}
                              KI-Caption
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showComments && post && (
        <CommentSheet
          postId={post.id}
          currentUserId={currentUserId}
          onClose={() => setShowComments(false)}
          onCommentAdded={() => setCommentCount((c) => c + 1)}
          onCommentDeleted={() => setCommentCount((c) => Math.max(0, c - 1))}
        />
      )}
    </>
  );
}
