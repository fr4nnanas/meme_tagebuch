"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { deletePostAction } from "@/lib/actions/feed";
import { ProfilePostDetailSheet } from "@/components/features/profile/profile-post-detail-sheet";
import { useActiveProject } from "@/components/features/app/project-context";
import { UserAvatarLightbox } from "@/components/shared/user-avatar-lightbox";

interface ProjectMemeGridProps {
  currentUserId: string;
  isAdmin?: boolean;
}

interface PostThumb {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
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

export function ProjectMemeGrid({
  currentUserId,
  isAdmin = false,
}: ProjectMemeGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeProjectId, activeProject, projects } = useActiveProject();
  const [result, setResult] = useState<FetchResult | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDeleteTransition] = useTransition();

  const detailPostId = searchParams.get("post");

  const detailFallbackSrc = useMemo(() => {
    if (!detailPostId || !result?.posts.length) return null;
    const thumb = result.posts.find((p) => p.id === detailPostId);
    return thumb ? (thumb.signed_url ?? thumb.original_signed_url) : null;
  }, [detailPostId, result?.posts]);

  const closePostDetail = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("post")) return;
    params.delete("post");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const openPostDetail = useCallback(
    (postId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("post", postId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const loadPosts = useCallback(async (projectId: string) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, user_id, meme_image_url, original_image_url, created_at, users!user_id(username, avatar_url)",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      setResult({ projectId, posts: [], error: "Posts konnten nicht geladen werden." });
      return;
    }

    type RawPost = Omit<PostThumb, "signed_url" | "original_signed_url" | "username" | "avatar_url"> & {
      users: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;
    };

    const postsRaw = (data ?? []) as RawPost[];

    const posts: Omit<PostThumb, "signed_url" | "original_signed_url">[] = postsRaw.map((p) => {
      const rawUser = p.users;
      const u = Array.isArray(rawUser) ? rawUser[0] : rawUser;
      return {
        id: p.id,
        user_id: p.user_id,
        meme_image_url: p.meme_image_url,
        original_image_url: p.original_image_url,
        created_at: p.created_at,
        username: u?.username ?? "Unbekannt",
        avatar_url: u?.avatar_url ?? null,
      };
    });

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
  }, []);

  useEffect(() => {
    if (!activeProjectId) return;
    setResult(null);
    void loadPosts(activeProjectId);
  }, [activeProjectId, loadPosts]);

  useEffect(() => {
    if (!detailPostId || !result?.posts.length) return;
    const exists = result.posts.some((p) => p.id === detailPostId);
    if (!exists) closePostDetail();
  }, [detailPostId, result?.posts, closePostDetail]);

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
        description="Sobald dich ein Admin einem Projekt zuweist, erscheint hier die Übersicht."
      />
    );
  }

  if (!activeProjectId) {
    return (
      <EmptyState
        title="Kein Projekt aktiv"
        description="Wähle im Profil ein Projekt aus, um alle Memes dieses Projekts zu sehen."
      />
    );
  }

  const isLoading = result === null || result.projectId !== activeProjectId;

  return (
    <div className="flex flex-col pb-6">
      <header className="flex items-center gap-2 px-4 pt-6">
        <Link
          href="/feed"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="Zurück zum Feed"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Projekt-Raster
          </h1>
          {activeProject && (
            <p className="mt-0.5 truncate text-sm text-zinc-500">{activeProject.name}</p>
          )}
        </div>
      </header>

      <p className="mt-3 px-4 text-sm text-zinc-500">
        Alle Memes des aktiven Projekts – antippen für Details wie im Profil.
      </p>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && result?.error && (
        <div className="mt-6 px-4">
          <EmptyState title="Fehler" description={result.error} />
        </div>
      )}

      {!isLoading && result && !result.error && result.posts.length === 0 && (
        <div className="mt-6 px-4">
          <EmptyState
            title="Noch keine Memes"
            description={
              activeProject
                ? `In „${activeProject.name}" gibt es noch keine Posts.`
                : "Noch keine Memes in diesem Projekt."
            }
          />
        </div>
      )}

      {!isLoading && result && !result.error && result.posts.length > 0 && (
        <div className="mt-6 px-1">
          <div className="grid grid-cols-3 gap-1">
            {result.posts.map((post) => {
              const displaySrc = post.signed_url ?? post.original_signed_url;
              const isDeleting = deletingId === post.id;
              const isPending = !post.meme_image_url;
              const canDelete =
                post.user_id === currentUserId || isAdmin;

              return (
                <div
                  key={post.id}
                  className="group relative aspect-[2/3] overflow-hidden rounded-md bg-zinc-800"
                >
                  <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-1.5 pb-6 pt-1.5">
                    <UserAvatarLightbox
                      avatarUrl={post.avatar_url}
                      username={post.username}
                      sizeClassName="h-7 w-7 shrink-0"
                      placeholderIconClassName="h-3.5 w-3.5"
                    />
                    <Link
                      href={`/profile/${post.user_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold leading-tight text-white drop-shadow-md"
                    >
                      {post.username}
                    </Link>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(post.id);
                        }}
                        disabled={isDeleting}
                        aria-label="Post löschen"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900/75 text-zinc-200 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-red-600/90 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {displaySrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displaySrc}
                      alt="Meme"
                      loading="lazy"
                      onClick={() => openPostDetail(post.id)}
                      className={`h-full w-full cursor-pointer object-cover transition-opacity active:opacity-75 ${
                        isPending ? "opacity-50" : ""
                      }`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-700">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}

                  {isPending && (
                    <span className="absolute bottom-1 left-1 z-10 rounded bg-zinc-800/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                      in Arbeit
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ProfilePostDetailSheet
        postId={detailPostId}
        fallbackImageSrc={detailFallbackSrc}
        currentUserId={currentUserId}
        onClose={closePostDetail}
      />
    </div>
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
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-800 p-6 text-center">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">{description}</p>
    </div>
  );
}
