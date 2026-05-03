"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import type { MemeStarSortMode } from "@/lib/actions/export";
import { sortPostsForDisplay } from "@/lib/meme/sort-posts";
import { PostStarRating } from "@/components/shared/post-star-rating";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { deletePostAction } from "@/lib/actions/feed";
import { ProfilePostDetailSheet } from "@/components/features/profile/profile-post-detail-sheet";
import { useActiveProject } from "@/components/features/app/project-context";
import { UserAvatarLightbox } from "@/components/shared/user-avatar-lightbox";
import { fetchMyStarRatingsForPostIds } from "@/lib/meme/fetch-my-star-ratings";

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
  star_rating_avg: number | null;
  star_rating_count: number;
  my_star_rating: number | null;
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
  const [gridSort, setGridSort] = useState<MemeStarSortMode>("created_desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDeleteTransition] = useTransition();

  const detailPostId = searchParams.get("post");

  const detailFallbackSrc = useMemo(() => {
    if (!detailPostId || !result?.posts.length) return null;
    const thumb = result.posts.find((p) => p.id === detailPostId);
    return thumb ? (thumb.signed_url ?? thumb.original_signed_url) : null;
  }, [detailPostId, result?.posts]);

  const displayedPosts = useMemo(() => {
    if (!result?.posts.length) return [];
    return sortPostsForDisplay(result.posts, gridSort);
  }, [result?.posts, gridSort]);

  const closePostDetail = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("post")) return;
    params.delete("post");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const handlePostMovedFromDetail = useCallback(() => {
    if (!detailPostId) return;
    setResult((prev) =>
      prev
        ? {
            ...prev,
            posts: prev.posts.filter((p) => p.id !== detailPostId),
          }
        : prev,
    );
    closePostDetail();
  }, [detailPostId, closePostDetail]);

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
        "id, user_id, meme_image_url, original_image_url, created_at, star_rating_avg, star_rating_count, users!user_id(username, avatar_url)",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      setResult({ projectId, posts: [], error: "Posts konnten nicht geladen werden." });
      return;
    }

    type RawPost = Omit<
      PostThumb,
      | "signed_url"
      | "original_signed_url"
      | "username"
      | "avatar_url"
      | "star_rating_avg"
      | "star_rating_count"
      | "my_star_rating"
    > & {
      users: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;
      star_rating_avg?: number | null;
      star_rating_count?: number | null;
    };

    const postsRaw = (data ?? []) as RawPost[];

    const postIds = postsRaw.map((p) => p.id);
    const myStars = await fetchMyStarRatingsForPostIds(
      supabase,
      currentUserId,
      postIds,
    );

    const posts: Omit<PostThumb, "signed_url" | "original_signed_url">[] = postsRaw.map((p) => {
      const rawUser = p.users;
      const u = Array.isArray(rawUser) ? rawUser[0] : rawUser;
      const cnt = Number(p.star_rating_count ?? 0);
      return {
        id: p.id,
        user_id: p.user_id,
        meme_image_url: p.meme_image_url,
        original_image_url: p.original_image_url,
        created_at: p.created_at,
        star_rating_avg:
          p.star_rating_avg != null ? Number(p.star_rating_avg) : null,
        star_rating_count: Number.isFinite(cnt) ? cnt : 0,
        my_star_rating: myStars.get(p.id) ?? null,
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
  }, [currentUserId]);

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
        Alle Memes des aktiven Projekts – antippen öffnet die große Ansicht; über
        „Alle Details & Kommentare“ oder das Kommentar-Symbol erreichst du
        Caption und Kommentare.
      </p>

      {!isLoading && result && !result.error && result.posts.length > 0 && (
        <div className="mt-4 px-4">
          <label htmlFor="raster-sort" className="sr-only">
            Sortierung
          </label>
          <select
            id="raster-sort"
            value={gridSort}
            onChange={(e) => setGridSort(e.target.value as MemeStarSortMode)}
            className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
          >
            <option value="created_desc">Neueste zuerst (chronologisch)</option>
            <option value="stars_desc">Sterne: höchste zuerst</option>
            <option value="stars_asc">Sterne: niedrigste zuerst</option>
          </select>
        </div>
      )}

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
            {displayedPosts.map((post) => {
              const displaySrc = post.signed_url ?? post.original_signed_url;
              const isDeleting = deletingId === post.id;
              const isPending = !post.meme_image_url;
              const canDelete =
                post.user_id === currentUserId || isAdmin;

              return (
                <div
                  key={post.id}
                  className="group flex flex-col overflow-hidden rounded-md border border-zinc-800/80 bg-zinc-800 shadow-sm"
                >
                  <div className="relative aspect-[2/3] w-full shrink-0 bg-zinc-900/40">
                    {displaySrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={displaySrc}
                        alt="Meme"
                        loading="lazy"
                        onClick={() => openPostDetail(post.id)}
                        className={`absolute inset-0 h-full w-full cursor-pointer object-cover transition-opacity active:opacity-75 ${
                          isPending ? "opacity-50" : ""
                        }`}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                    {isPending && (
                      <span className="absolute bottom-1 left-1 z-10 rounded bg-zinc-800/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                        in Arbeit
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1 border-t border-zinc-700/80 bg-zinc-900/95 px-1 py-1.5">
                    <UserAvatarLightbox
                      avatarUrl={post.avatar_url}
                      username={post.username}
                      sizeClassName="h-7 w-7 shrink-0"
                      placeholderIconClassName="h-3.5 w-3.5"
                    />
                    <Link
                      href={`/profile/${post.user_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-0 max-w-[34%] truncate text-left text-[11px] font-semibold leading-tight text-zinc-200 hover:text-orange-400 sm:max-w-[40%]"
                    >
                      {post.username}
                    </Link>
                    {post.meme_image_url ? (
                      <div
                        className="flex min-w-0 shrink-0 items-center"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <PostStarRating
                          postId={post.id}
                          starRatingAvg={post.star_rating_avg}
                          starRatingCount={post.star_rating_count}
                          myStarRating={post.my_star_rating}
                          interactive
                          updateAggregateDisplayAfterSubmit={false}
                          compact
                          className="gap-0"
                        />
                      </div>
                    ) : null}
                    <span className="min-w-0 flex-1" aria-hidden />
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(post.id);
                        }}
                        disabled={isDeleting}
                        aria-label="Post löschen"
                        className="flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-full bg-zinc-800/90 text-zinc-300 opacity-100 shadow-sm transition-opacity hover:bg-red-600/90 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
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
        isAdmin={isAdmin}
        entryAsLightbox
        onClose={closePostDetail}
        onPostMoved={handlePostMovedFromDetail}
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
