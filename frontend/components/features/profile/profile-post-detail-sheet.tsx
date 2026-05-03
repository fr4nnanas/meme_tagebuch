"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Check,
  Heart,
  Loader2,
  MessageCircle,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchPostDetailAction,
  togglePostLikeAction,
  updatePostCaptionAction,
  type PostWithDetails,
} from "@/lib/actions/feed";
import { useJobContext } from "@/components/features/app/job-context";
import { CommentThread } from "@/components/features/feed/comment-thread";
import { PostLikersOverlay } from "@/components/features/feed/post-likers-overlay";
import { PostRecentLikersOnImage } from "@/components/features/feed/post-recent-likers-on-image";
import { MemeImageLightbox } from "@/components/shared/meme-image-lightbox";
import { MemePromptDisclosure } from "@/components/shared/meme-prompt-disclosure";
import { UserAvatarLightbox } from "@/components/shared/user-avatar-lightbox";
import { shareMemeFromPost } from "@/lib/share/web-share";
import { getJobStatusForPostAction } from "@/lib/actions/meme-job";
import type { JobStatusResponse } from "@/lib/meme/job-status-types";

function shouldOpenMemeCompletionUI(d: JobStatusResponse): boolean {
  if (d.status !== "completed" || d.errorMsg) return false;
  if (d.memeType === "ai_generated" && d.variantSignedUrls && d.variantSignedUrls.length > 0) {
    return true;
  }
  if (
    d.memeType === "canvas_overlay" &&
    d.originalSignedUrl &&
    (d.overlayTextTop || d.overlayTextBottom)
  ) {
    return true;
  }
  return false;
}

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
  const { markJobCompleted } = useJobContext();
  const recoveryFiredRef = useRef<string | null>(null);
  const [memeJobError, setMemeJobError] = useState<string | null>(null);
  const [jobPollDetail, setJobPollDetail] = useState<{
    status: JobStatusResponse["status"];
    jobUpdatedAt?: string;
  } | null>(null);

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

  const [commentCount, setCommentCount] = useState(0);
  const [showCaptionEdit, setShowCaptionEdit] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");
  const [currentCaption, setCurrentCaption] = useState<string | null>(null);
  const [isGeneratingCaption, startGenerateCaptionTransition] = useTransition();
  const [isSavingCaption, startSaveCaptionTransition] = useTransition();
  const [isLiking, startLikeTransition] = useTransition();
  const [isSharing, startShareTransition] = useTransition();
  const [likersOpen, setLikersOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const commentComposerRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToCommentsAndFocusComposer = useCallback(() => {
    if (!post) return;
    setLightboxOpen(false);
    const targetId = post.id;
    window.requestAnimationFrame(() => {
      document.getElementById(`comments-${targetId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          commentComposerRef.current?.focus({ preventScroll: true });
        });
      });
    });
  }, [post]);

  useEffect(() => {
    if (!postId) {
      setPost(null);
      setLoadError(null);
      setIsLoadingDetail(false);
      return;
    }

    setLightboxOpen(false);
    let cancelled = false;
    setIsLoadingDetail(true);
    setLoadError(null);
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
    recoveryFiredRef.current = null;
    setMemeJobError(null);
    setJobPollDetail(null);
  }, [postId]);

  useEffect(() => {
    setLikersOpen(false);
  }, [postId]);

  useEffect(() => {
    if (!postId) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [postId]);

  function handleBackdropClose() {
    onClose();
  }

  useEffect(() => {
    if (
      !post ||
      post.meme_image_url ||
      String(post.user_id) !== String(currentUserId)
    ) {
      setMemeJobError(null);
      setJobPollDetail(null);
      return;
    }

    const p = post;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    async function tick() {
      const res = await getJobStatusForPostAction(p.id);
      if (cancelled) return;

      if (!res.ok) {
        setMemeJobError(res.error);
        setJobPollDetail(null);
        return;
      }

      if ("noJob" in res && res.noJob) {
        setMemeJobError(null);
        setJobPollDetail(null);
        return;
      }

      if (!("data" in res)) return;
      const d = res.data;

      setJobPollDetail({
        status: d.status,
        jobUpdatedAt: d.jobUpdatedAt,
      });

      if (d.status === "failed") {
        setMemeJobError(d.errorMsg ?? "Meme-Erstellung fehlgeschlagen");
        if (interval) clearInterval(interval);
        return;
      }

      if (shouldOpenMemeCompletionUI(d)) {
        if (recoveryFiredRef.current !== p.id) {
          recoveryFiredRef.current = p.id;
          markJobCompleted(d);
        }
        setMemeJobError(null);
        setJobPollDetail(null);
        if (interval) clearInterval(interval);
        return;
      }

      if (d.status === "completed" && d.errorMsg) {
        setMemeJobError(d.errorMsg);
        if (interval) clearInterval(interval);
        return;
      }

      if (d.status === "pending" || d.status === "processing") {
        setMemeJobError(null);
        return;
      }

      setMemeJobError(null);
    }

    void tick();
    interval = setInterval(() => void tick(), 3000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [post, currentUserId, markJobCompleted]);

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
      setPost((prev) =>
        prev
          ? {
              ...prev,
              like_count: result.like_count,
              liked_by_me: result.liked,
              recent_likers: result.recent_likers,
            }
          : null,
      );
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

  function handleShareMeme() {
    if (!post?.signed_url) return;
    startShareTransition(async () => {
      const outcome = await shareMemeFromPost({
        imageUrl: post.signed_url,
        username: post.user.username,
        userId: post.user_id,
        caption: currentCaption ?? post.caption ?? null,
      });
      if (outcome === "shared") {
        toast.success("Geteilt.");
      } else if (outcome === "downloaded") {
        toast.success("Bild wurde heruntergeladen.");
      } else if (outcome === "unavailable") {
        toast.error("Teilen wird hier nicht unterstützt.");
      }
    });
  }

  if (!postId) return null;

  /** Post-Autor kann Caption bearbeiten (Server prüft beim Speichern erneut). */
  const isPostAuthor =
    post !== null && String(post.user_id) === String(currentUserId);
  const canEditCaption = isPostAuthor;
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

  const isOwnerOfPipelinePost = Boolean(isPostAuthor && post);
  const pipelineStaleMs = 3 * 60 * 1000;
  const pipelineUpdatedMs = jobPollDetail?.jobUpdatedAt
    ? new Date(jobPollDetail.jobUpdatedAt).getTime()
    : null;
  const pipelineLooksStale =
    pipelineUpdatedMs != null &&
    Date.now() - pipelineUpdatedMs > pipelineStaleMs &&
    (jobPollDetail?.status === "pending" ||
      jobPollDetail?.status === "processing");

  /** Wie Feed-Card: Kommentar, Like, Geliked, Teilen rechts — für Sheet und Lightbox */
  const postSocialActionsEl =
    !isLoadingDetail && post ? (
      <div className="mx-auto flex w-full max-w-lg items-center gap-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={scrollToCommentsAndFocusComposer}
            aria-label="Kommentar schreiben"
            className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
          >
            <MessageCircle className="h-5 w-5" />
            <span>{commentCount}</span>
          </button>

          <div className="flex items-center gap-0">
            <button
              type="button"
              onClick={handleLike}
              disabled={isLiking}
              aria-label={optimisticLike.liked ? "Like entfernen" : "Liken"}
              className={`flex h-10 items-center gap-1.5 rounded-full text-sm font-medium transition-colors hover:bg-zinc-800/80 disabled:cursor-not-allowed ${
                optimisticLike.count > 0 ? "pl-3 pr-0.5" : "px-3"
              }`}
            >
              <Heart
                className={`h-5 w-5 transition-colors ${
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

            {optimisticLike.count > 0 && (
              <button
                type="button"
                onClick={() => setLikersOpen(true)}
                aria-haspopup="dialog"
                className="flex h-10 items-center rounded-full pl-0.5 pr-3 text-sm font-medium text-zinc-400 underline-offset-2 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
              >
                Geliked
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleShareMeme}
          disabled={isSharing || !post.signed_url}
          aria-label="Meme teilen"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSharing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Share2 className="h-5 w-5" />
          )}
        </button>
      </div>
    ) : null;

  return (
    <>
      {postId && (
        <PostLikersOverlay
          postId={postId}
          open={likersOpen}
          onOpenChange={setLikersOpen}
        />
      )}

      <MemeImageLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        memeSrc={post?.signed_url ?? fallbackImageSrc}
        originalSrc={post?.original_signed_url ?? null}
        footer={postSocialActionsEl ?? undefined}
      />

      <div
        className="fixed inset-0 z-[30] bg-black/70 backdrop-blur-sm"
        onClick={handleBackdropClose}
      />

      <div className="fixed inset-0 z-[35] flex flex-col overflow-hidden">
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 border-b border-zinc-800 bg-zinc-900/95 px-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex w-10 shrink-0 justify-center" aria-hidden>
            <span className="inline-block w-10" />
          </div>
          <div className="flex min-w-0 justify-center px-2 text-center">
            {post ? (
              <div className="inline-flex max-w-full items-center justify-center gap-2 rounded-xl py-1">
                <UserAvatarLightbox
                  avatarUrl={post.user.avatar_url}
                  username={post.user.username}
                  sizeClassName="h-8 w-8"
                  placeholderIconClassName="h-4 w-4"
                />
                <Link
                  href={`/profile/${post.user_id}`}
                  className="min-w-0 outline-none ring-orange-500/40 focus-visible:ring-2"
                  onClick={onClose}
                >
                  <div className="text-left">
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {post.user.username}
                    </p>
                    <p className="text-xs text-zinc-500">{createdAt}</p>
                  </div>
                </Link>
              </div>
            ) : (
              <span className="text-sm font-medium text-zinc-400">Post</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-12 w-12 items-center justify-center justify-self-end self-end rounded-full border border-zinc-600/80 bg-zinc-800 text-zinc-100 shadow-md ring-1 ring-white/10 transition-colors hover:border-orange-500/50 hover:bg-zinc-700 hover:text-white active:scale-[0.97] sm:mb-0.5"
          >
            <X className="h-7 w-7" strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto overscroll-contain bg-zinc-900 pb-[env(safe-area-inset-bottom,12px)]"
          onClick={(e) => e.stopPropagation()}
        >
          {loadError && (
            <p className="px-6 py-8 text-center text-sm text-red-400">{loadError}</p>
          )}

          {!loadError && (
            <>
              <div className="mx-auto aspect-[2/3] w-full max-w-md bg-zinc-800">
                {imgSrc ? (
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    aria-label="Bild vergrößern"
                    className="relative block h-full w-full cursor-zoom-in border-0 bg-transparent p-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgSrc}
                      alt="Meme"
                      className="h-full w-full object-cover"
                    />
                    {post ? (
                      <PostRecentLikersOnImage
                        likers={post.recent_likers}
                        likeCount={optimisticLike.count}
                        onOpenList={() => setLikersOpen(true)}
                      />
                    ) : null}
                  </button>
                ) : (
                  <div className="flex h-full min-h-[200px] w-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
                  </div>
                )}
              </div>

              {!isLoadingDetail && post && post.meme_image_url ? (
                <MemePromptDisclosure pipelineInputText={post.pipeline_input_text} />
              ) : null}

              {!isLoadingDetail && post && !post.meme_image_url && (
                <div className="border-b border-zinc-800 px-4 py-4">
                  {memeJobError ? (
                    <div className="space-y-3">
                      <p className="text-center text-xs font-semibold uppercase tracking-wider text-red-400/90">
                        Fehler bei der Meme-Erstellung
                      </p>
                      <p className="text-center text-sm leading-relaxed text-red-200/95">
                        {memeJobError}
                      </p>
                      {isOwnerOfPipelinePost && (
                        <Link
                          href={`/upload?retry=${post.id}`}
                          onClick={onClose}
                          className="flex h-11 w-full items-center justify-center rounded-full bg-orange-500 text-sm font-semibold text-white shadow-md transition-colors hover:bg-orange-400 active:scale-[0.99]"
                        >
                          Anpassen und erneut versuchen
                        </Link>
                      )}
                    </div>
                  ) : !isPostAuthor ? (
                    <p className="text-center text-sm text-zinc-400">
                      Meme-Erstellung noch in Arbeit
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-center text-sm text-zinc-300">
                        {jobPollDetail?.status === "processing"
                          ? "Die KI verarbeitet dein Bild …"
                          : jobPollDetail?.status === "pending"
                            ? "Dein Meme steht in der Warteschlange …"
                            : "Meme-Erstellung läuft …"}
                      </p>
                      {pipelineLooksStale && (
                        <>
                          <p className="text-center text-xs leading-relaxed text-amber-400/95">
                            Das dauert ungewöhnlich lange. Du kannst den Vorgang
                            mit denselben Einstellungen erneut starten.
                          </p>
                          <Link
                            href={`/upload?retry=${post.id}`}
                            onClick={onClose}
                            className="flex h-11 w-full items-center justify-center rounded-full border border-zinc-600 bg-zinc-800 text-sm font-semibold text-zinc-100 transition-colors hover:border-orange-500/60 hover:text-orange-300"
                          >
                            Bearbeiten und erneut starten
                          </Link>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!isLoadingDetail && post && (
                <>
                  <div className="border-b border-zinc-800 px-3 pt-2">
                    {postSocialActionsEl}
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
                          className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500"
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
                          canEditCaption && (
                            <p className="text-xs italic text-zinc-500">Noch keine Caption.</p>
                          )
                        )}

                        {canEditCaption && !showCaptionEdit && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowCaptionEdit(true)}
                              className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-orange-500 hover:text-orange-400"
                            >
                              {currentCaption
                                ? "Caption bearbeiten"
                                : "Caption hinzufügen"}
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

                  <div className="px-4 pb-6">
                    <CommentThread
                      postId={post.id}
                      currentUserId={currentUserId}
                      composerRef={commentComposerRef}
                      onCommentAdded={() => setCommentCount((c) => c + 1)}
                      onCommentDeleted={() => setCommentCount((c) => Math.max(0, c - 1))}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
