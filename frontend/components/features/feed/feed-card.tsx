"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import {
  Check,
  Heart,
  Loader2,
  MessageCircle,
  MoreVertical,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  deletePostAction,
  togglePostLikeAction,
  updatePostCaptionAction,
  type PostWithDetails,
} from "@/lib/actions/feed";
import { UserAvatarLightbox } from "@/components/shared/user-avatar-lightbox";
import { CommentSheet } from "./comment-sheet";

interface FeedCardProps {
  post: PostWithDetails;
  currentUserId: string;
  isAdmin?: boolean;
  onDeleted: (postId: string) => void;
  onCaptionUpdated: (postId: string, caption: string) => void;
  onCommentCountChange: (postId: string, delta: number) => void;
}

interface LikeState {
  liked: boolean;
  count: number;
}

export function FeedCard({
  post,
  currentUserId,
  isAdmin = false,
  onDeleted,
  onCaptionUpdated,
  onCommentCountChange,
}: FeedCardProps) {
  const isOwner = post.user_id === currentUserId;
  const canDelete = isOwner || isAdmin;

  const [likeState, setLikeState] = useState<LikeState>({
    liked: post.liked_by_me,
    count: post.like_count,
  });
  const [optimisticLike, addOptimisticLike] = useOptimistic(
    likeState,
    (_state, next: LikeState) => next,
  );

  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showCaptionEdit, setShowCaptionEdit] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(post.caption ?? "");
  const [currentCaption, setCurrentCaption] = useState(post.caption);
  const [isGeneratingCaption, startGenerateCaptionTransition] = useTransition();
  const [isSavingCaption, startSaveCaptionTransition] = useTransition();
  const [isDeletingPost, startDeleteTransition] = useTransition();
  const [isLiking, startLikeTransition] = useTransition();

  function handleLike() {
    if (isLiking) return;
    const next: LikeState = {
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

  function handleDeletePost() {
    setShowMenu(false);
    startDeleteTransition(async () => {
      const result = await deletePostAction(post.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Post gelöscht.");
      onDeleted(post.id);
    });
  }

  function handleGenerateCaption() {
    if (!post.meme_image_url) return;
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
    startSaveCaptionTransition(async () => {
      const result = await updatePostCaptionAction(post.id, captionDraft);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setCurrentCaption(captionDraft || null);
      setShowCaptionEdit(false);
      onCaptionUpdated(post.id, captionDraft);
      toast.success("Caption gespeichert.");
    });
  }

  function handleCancelCaption() {
    setCaptionDraft(currentCaption ?? "");
    setShowCaptionEdit(false);
  }

  const createdAt = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(post.created_at));

  return (
    <>
      <article className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800">
        {/* Header: Avatar + Username + Menu */}
        <div className="flex items-center gap-3 px-4 py-3">
          <UserAvatarLightbox
            avatarUrl={post.user.avatar_url}
            username={post.user.username}
            sizeClassName="h-9 w-9"
          />
          <Link
            href={`/profile/${post.user_id}`}
            aria-label={`Profil von ${post.user.username}`}
            className="flex min-w-0 flex-1 items-center rounded-xl py-0.5 pr-1 outline-none ring-orange-500/40 transition-colors hover:bg-zinc-800/60 focus-visible:ring-2"
          >
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-semibold text-zinc-100">
                {post.user.username}
              </p>
              <p className="text-xs text-zinc-500">{createdAt}</p>
            </div>
          </Link>

          {canDelete && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu((v) => !v)}
                aria-label="Post-Optionen"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                <MoreVertical className="h-5 w-5" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-10 z-20 min-w-[160px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800 shadow-2xl">
                    {isAdmin && !isOwner && (
                      <p className="border-b border-zinc-800 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-orange-400">
                        Admin-Aktion
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleDeletePost}
                      disabled={isDeletingPost}
                      className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-400 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isDeletingPost ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Post löschen
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Meme image */}
        <div className="aspect-[2/3] w-full overflow-hidden bg-zinc-800">
          {post.signed_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.signed_url}
              alt="Meme"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-600">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </div>

        {/* Actions: Like + Comment */}
        <div className="flex items-center gap-1 px-3 pt-2">
          <button
            type="button"
            onClick={handleLike}
            disabled={isLiking}
            aria-label={optimisticLike.liked ? "Like entfernen" : "Liken"}
            className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed"
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

          <button
            type="button"
            onClick={() => setShowComments(true)}
            aria-label="Kommentare anzeigen"
            className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <MessageCircle className="h-5 w-5" />
            <span>{post.comment_count}</span>
          </button>
        </div>

        {/* Caption */}
        <div className="px-4 pb-1">
          {showCaptionEdit ? (
            <div className="mt-1 flex flex-col gap-2">
              <textarea
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Caption schreiben…"
                className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveCaption}
                  disabled={isSavingCaption}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-orange-500 text-sm font-semibold text-white transition-colors hover:bg-orange-400 disabled:opacity-60"
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
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition-colors hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-1">
              {currentCaption ? (
                <p className="text-sm text-zinc-200">
                  <Link
                    href={`/profile/${post.user_id}`}
                    className="font-semibold text-zinc-100 underline-offset-2 hover:text-orange-400 hover:underline"
                  >
                    {post.user.username}
                  </Link>{" "}
                  {currentCaption}
                </p>
              ) : (
                isOwner && (
                  <p className="text-xs italic text-zinc-500">Noch keine Caption.</p>
                )
              )}
            </div>
          )}

          {/* KI-Caption-Button – nur für Owner sichtbar, nicht für Admin bei fremden Posts */}
          {isOwner && !showCaptionEdit && (
            <button
              type="button"
              onClick={handleGenerateCaption}
              disabled={isGeneratingCaption || !post.meme_image_url}
              className="mt-2 flex h-8 items-center gap-1.5 rounded-full border border-zinc-700 px-3 text-xs font-medium text-zinc-400 transition-colors hover:border-orange-500 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isGeneratingCaption ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              KI-Caption generieren
            </button>
          )}
        </div>

        {/* Bottom padding */}
        <div className="h-3" />
      </article>

      {/* Comment Sheet */}
      {showComments && (
        <CommentSheet
          postId={post.id}
          currentUserId={currentUserId}
          onClose={() => setShowComments(false)}
          onCommentAdded={() => onCommentCountChange(post.id, 1)}
          onCommentDeleted={() => onCommentCountChange(post.id, -1)}
        />
      )}
    </>
  );
}
