"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Heart, Loader2, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  addCommentAction,
  deleteCommentAction,
  fetchCommentsAction,
  toggleCommentLikeAction,
  type CommentWithDetails,
} from "@/lib/actions/feed";
import { UserAvatarLightbox } from "@/components/shared/user-avatar-lightbox";

interface CommentSheetProps {
  postId: string;
  currentUserId: string;
  onClose: () => void;
  onCommentAdded: () => void;
  onCommentDeleted: () => void;
}

export function CommentSheet({
  postId,
  currentUserId,
  onClose,
  onCommentAdded,
  onCommentDeleted,
}: CommentSheetProps) {
  const [comments, setComments] = useState<CommentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [text, setText] = useState("");
  const [isSubmitting, startSubmitTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchCommentsAction(postId)
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          toast.error(result.error);
        } else {
          setComments(result.comments);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  // Sperrt Scroll des Hintergrunds, solange das Sheet offen ist
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  function handleSubmit() {
    if (!text.trim() || isSubmitting) return;
    const content = text.trim();
    setText("");
    startSubmitTransition(async () => {
      const result = await addCommentAction(postId, content);
      if (result.error) {
        toast.error(result.error);
        setText(content);
        return;
      }
      if (result.comment) {
        setComments((prev) => [...prev, result.comment!]);
        onCommentAdded();
        // Liste nach unten scrollen
        requestAnimationFrame(() => {
          listRef.current?.scrollTo({
            top: listRef.current.scrollHeight,
            behavior: "smooth",
          });
        });
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleDeleteComment(commentId: string) {
    // Optimistisch entfernen
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    onCommentDeleted();

    deleteCommentAction(commentId).then((result) => {
      if (result.error) {
        toast.error(result.error);
        // Bei Fehler Kommentare neu laden wäre aufwändig – einfach Hinweis zeigen
      }
    });
  }

  function handleToggleCommentLike(commentId: string) {
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;

    // Optimistisches Update
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              liked_by_me: !c.liked_by_me,
              like_count: c.liked_by_me ? c.like_count - 1 : c.like_count + 1,
            }
          : c,
      ),
    );

    toggleCommentLikeAction(commentId).then((result) => {
      if (result.error) {
        toast.error(result.error);
        // Optimistisches Update rückgängig machen
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, liked_by_me: comment.liked_by_me, like_count: comment.like_count }
              : c,
          ),
        );
      } else {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, liked_by_me: result.liked, like_count: result.like_count }
              : c,
          ),
        );
      }
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-2xl border-t border-zinc-800 bg-zinc-900">
        {/* Handle + Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-zinc-700" />
        </div>
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 pb-3">
          <h2 className="text-base font-semibold text-zinc-100">Kommentare</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Comment list */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          )}

          {!isLoading && comments.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">
              Noch keine Kommentare. Schreib den ersten!
            </p>
          )}

          {!isLoading && comments.length > 0 && (
            <ul className="flex flex-col gap-4">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  isOwner={comment.user_id === currentUserId}
                  onDelete={handleDeleteComment}
                  onToggleLike={handleToggleCommentLike}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-zinc-800 p-3 pb-[env(safe-area-inset-bottom,12px)]">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Kommentar schreiben…"
              rows={1}
              maxLength={500}
              className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500"
              style={{ maxHeight: "120px", overflowY: "auto" }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || isSubmitting}
              aria-label="Kommentar senden"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

interface CommentItemProps {
  comment: CommentWithDetails;
  isOwner: boolean;
  onDelete: (id: string) => void;
  onToggleLike: (id: string) => void;
}

function CommentItem({ comment, isOwner, onDelete, onToggleLike }: CommentItemProps) {
  const createdAt = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(comment.created_at));

  return (
    <li className="flex items-start gap-3">
      <UserAvatarLightbox
        avatarUrl={comment.user.avatar_url}
        username={comment.user.username}
        sizeClassName="h-8 w-8"
        placeholderIconClassName="h-4 w-4"
      />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-zinc-100">
            {comment.user.username}
          </span>
          <span className="text-xs text-zinc-500">{createdAt}</span>
        </div>
        <p className="mt-0.5 text-sm leading-snug text-zinc-300">{comment.content}</p>
      </div>

      {/* Actions: like + delete */}
      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onToggleLike(comment.id)}
          aria-label={comment.liked_by_me ? "Like entfernen" : "Kommentar liken"}
          className="flex h-8 items-center gap-1 rounded-full px-2 text-xs transition-colors hover:bg-zinc-800"
        >
          <Heart
            className={`h-3.5 w-3.5 ${
              comment.liked_by_me
                ? "fill-orange-500 text-orange-500"
                : "text-zinc-500"
            }`}
          />
          {comment.like_count > 0 && (
            <span
              className={comment.liked_by_me ? "text-orange-400" : "text-zinc-500"}
            >
              {comment.like_count}
            </span>
          )}
        </button>

        {isOwner && (
          <button
            type="button"
            onClick={() => onDelete(comment.id)}
            aria-label="Kommentar löschen"
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}
