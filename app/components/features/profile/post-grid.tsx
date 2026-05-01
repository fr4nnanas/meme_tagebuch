"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ImageIcon, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { deletePostAction } from "@/lib/actions/feed";
import { useActiveProject } from "@/components/features/app/project-context";

interface PostGridProps {
  userId: string;
  isOwner?: boolean;
}

interface PostThumb {
  id: string;
  meme_image_url: string | null;
  original_image_url: string;
  created_at: string;
  signed_url: string | null;
  original_signed_url: string | null;
}

interface FetchResult {
  projectId: string;
  posts: PostThumb[];
  error: string | null;
}

export function PostGrid({ userId, isOwner = false }: PostGridProps) {
  const { activeProjectId, activeProject, projects } = useActiveProject();
  const [result, setResult] = useState<FetchResult | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDeleteTransition] = useTransition();

  const loadPosts = useCallback(
    async (projectId: string) => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("posts")
        .select("id, meme_image_url, original_image_url, created_at")
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        setResult({ projectId, posts: [], error: "Posts konnten nicht geladen werden." });
        return;
      }

      const posts = (data ?? []) as Omit<PostThumb, "signed_url" | "original_signed_url">[];

      // Signed URLs für den memes-Bucket generieren
      const memePaths = posts
        .filter((p) => p.meme_image_url)
        .map((p) => p.meme_image_url as string);

      const originalPaths = posts
        .filter((p) => !p.meme_image_url && p.original_image_url)
        .map((p) => p.original_image_url);

      const memeSignedMap: Record<string, string> = {};
      const originalSignedMap: Record<string, string> = {};

      if (memePaths.length > 0) {
        const { data: signed } = await supabase.storage
          .from("memes")
          .createSignedUrls(memePaths, 3600);
        if (signed) {
          memePaths.forEach((path, i) => {
            const su = signed[i];
            if (su?.signedUrl) memeSignedMap[path] = su.signedUrl;
          });
        }
      }

      if (originalPaths.length > 0) {
        const { data: signed } = await supabase.storage
          .from("originals")
          .createSignedUrls(originalPaths, 3600);
        if (signed) {
          originalPaths.forEach((path, i) => {
            const su = signed[i];
            if (su?.signedUrl) originalSignedMap[path] = su.signedUrl;
          });
        }
      }

      const postsWithUrls: PostThumb[] = posts.map((p) => ({
        ...p,
        signed_url: p.meme_image_url ? (memeSignedMap[p.meme_image_url] ?? null) : null,
        original_signed_url: p.original_image_url
          ? (originalSignedMap[p.original_image_url] ?? null)
          : null,
      }));

      setResult({ projectId, posts: postsWithUrls, error: null });
    },
    [userId],
  );

  useEffect(() => {
    if (!activeProjectId) return;
    setResult(null);
    void loadPosts(activeProjectId);
  }, [activeProjectId, loadPosts]);

  function handleDelete(postId: string) {
    if (!window.confirm("Diesen Post wirklich löschen?")) return;
    setDeletingId(postId);
    startDeleteTransition(async () => {
      const res = await deletePostAction(postId);
      setDeletingId(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Post gelöscht.");
      setResult((prev) =>
        prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== postId) } : prev,
      );
    });
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        title="Noch kein Projekt"
        description="Sobald dich ein Admin einem Projekt zuweist, erscheinen hier deine Posts."
      />
    );
  }

  if (!activeProjectId) {
    return (
      <EmptyState
        title="Kein Projekt aktiv"
        description="Wähle oben ein Projekt aus, um deine Memes zu sehen."
      />
    );
  }

  const isLoading = result === null || result.projectId !== activeProjectId;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (result.error) {
    return <EmptyState title="Fehler" description={result.error} />;
  }

  if (result.posts.length === 0) {
    return (
      <EmptyState
        title="Noch keine Posts"
        description={
          activeProject
            ? `In „${activeProject.name}" hast du noch keine Memes gepostet.`
            : "Wähle ein Projekt aus, um deine Memes zu sehen."
        }
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {result.posts.map((post) => {
          const displaySrc = post.signed_url ?? post.original_signed_url;
          const isDeleting = deletingId === post.id;
          const isPending = !post.meme_image_url;

          return (
            <div
              key={post.id}
              className="group relative aspect-[2/3] overflow-hidden rounded-md bg-zinc-900"
            >
              {displaySrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displaySrc}
                  alt="Post"
                  loading="lazy"
                  onClick={() => !isPending && setLightboxSrc(displaySrc)}
                  className={`h-full w-full object-cover transition-opacity ${
                    isPending ? "opacity-50" : "cursor-pointer active:opacity-75"
                  }`}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-700">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}

              {isPending && (
                <span className="absolute bottom-1 left-1 rounded bg-zinc-950/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                  in Arbeit
                </span>
              )}

              {isOwner && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(post.id);
                  }}
                  disabled={isDeleting}
                  aria-label="Post löschen"
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950/70 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            aria-label="Schließen"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Meme"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900 p-6 text-center">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">{description}</p>
    </div>
  );
}
