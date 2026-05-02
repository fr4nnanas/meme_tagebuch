"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Heart, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addCommentAction,
  deleteCommentAction,
  fetchCommentsAction,
  toggleCommentLikeAction,
  type CommentWithDetails,
} from "@/lib/actions/feed";
import { UserAvatarLightbox } from "@/components/shared/user-avatar-lightbox";

export interface CommentThreadProps {
  postId: string;
  currentUserId: string;
  onCommentAdded: () => void;
  onCommentDeleted: () => void;
  className?: string;
}

export function CommentThread({
  postId,
  currentUserId,
  onCommentAdded,
  onCommentDeleted,
  className = "",
}: CommentThreadProps) {
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
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    onCommentDeleted();

    deleteCommentAction(commentId).then((result) => {
      if (result.error) {
        toast.error(result.error);
      }
    });
  }

  function handleToggleCommentLike(commentId: string) {
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;

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
    <section
      id={`comments-${postId}`}
      className={`border-t border-zinc-800/90 ${className}`}
    >
      <h3 className="px-1 pt-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Kommentare
      </h3>

      <div ref={listRef} className="px-1 py-2">
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        )}

        {!isLoading && comments.length > 0 && (
          <ul className="flex flex-col gap-3">
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

      <div className="border-t border-zinc-800/90 px-0 pb-1 pt-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Kommentar schreiben…"
            rows={1}
            maxLength={500}
            className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500"
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
    </section>
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

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-zinc-100">
            {comment.user.username}
          </span>
          <span className="text-xs text-zinc-500">{createdAt}</span>
        </div>
        <p className="mt-0.5 text-sm leading-snug text-zinc-300">{comment.content}</p>
      </div>

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
