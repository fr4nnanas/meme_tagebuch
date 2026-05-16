"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { deletePostAction } from "@/lib/actions/feed";
import { ProfilePostDetailSheet } from "@/components/features/profile/profile-post-detail-sheet";
import { useActiveProject } from "@/components/features/app/project-context";
import {
  PostStarRating,
  type PostStarRatingSnapshot,
} from "@/components/shared/post-star-rating";
import { GridPostThumbnail } from "@/components/shared/grid-post-thumbnail";
import { PostRemixButton } from "@/components/shared/post-remix-button";
import {
  POST_GRID_PAGE_SIZE,
  resolvePostGridThumbUrls,
} from "@/lib/meme/post-grid-media";
import { resolvePostMediaPublicUrl } from "@/lib/storage/r2-url";
import { fetchMyStarRatingsForPostIds } from "@/lib/meme/fetch-my-star-ratings";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
interface PostGridProps {
  userId: string;
  /** Eingeloggter Nutzer – für Likes, Kommentare, Caption im Detail */
  currentUserId: string;
  isOwner?: boolean;
  /** Admin darf fremde Posts verschieben */
  viewerIsAdmin?: boolean;
}

interface PostThumb {
  id: string;
  meme_image_url: string | null;
  original_image_url: string;
  original_image_url_2?: string | null;
  created_at: string;
  star_rating_avg: number | null;
  star_rating_count: number;
  my_star_rating: number | null;
  signed_url: string | null;
  original_signed_url: string | null;
  original_signed_urls: string[];
  full_fallback_url: string | null;
}

interface FetchResult {
  projectId: string;
  posts: PostThumb[];
  error: string | null;
  page: number;
  hasMore: boolean;
}

const GRID_PAGE_SIZE = POST_GRID_PAGE_SIZE;

export function PostGrid({
  userId,
  currentUserId,
  isOwner = false,
  viewerIsAdmin = false,
}: PostGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeProjectId, activeProject, projects } = useActiveProject();
  const [result, setResult] = useState<FetchResult | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDeleteTransition] = useTransition();
  const [isLoadingMore, startLoadMoreTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  const detailPostId = searchParams.get("post");

  const detailFallbackSrc = useMemo(() => {
    if (!detailPostId || !result?.posts.length) return null;
    const thumb = result.posts.find((p) => p.id === detailPostId);
    return thumb
      ? (thumb.full_fallback_url ??
          thumb.signed_url ??
          thumb.original_signed_url)
      : null;
  }, [detailPostId, result?.posts]);

  const detailFallbackOriginalSrc = useMemo(() => {
    if (!detailPostId || !result?.posts.length) return null;
    const thumb = result.posts.find((p) => p.id === detailPostId);
    return thumb?.original_signed_urls?.length
      ? thumb.original_signed_urls
      : (thumb?.original_signed_url ?? null);
  }, [detailPostId, result?.posts]);

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

  const loadPosts = useCallback(
    async (projectId: string, targetPage: number, append: boolean) => {
      const supabase = createClient();
      setIsLoading(true);

      try {
        const from = targetPage * GRID_PAGE_SIZE;
        const to = from + GRID_PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from("posts")
          .select(
            "id, meme_image_url, original_image_url, original_image_url_2, created_at, star_rating_avg, star_rating_count",
          )
          .eq("user_id", userId)
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) {
          setResult({
            projectId,
            posts: [],
            error: "Posts konnten nicht geladen werden.",
            page: 0,
            hasMore: false,
          });
          return;
        }

        type RawRow = {
          id: string;
          meme_image_url: string | null;
          original_image_url: string;
          original_image_url_2?: string | null;
          created_at: string;
          star_rating_avg?: number | null;
          star_rating_count?: number | null;
        };

        const rows = (data ?? []) as RawRow[];
        const postIds = rows.map((r) => r.id);

        const posts: Omit<
          PostThumb,
          "signed_url" | "original_signed_url" | "original_signed_urls" | "full_fallback_url"
        >[] = rows.map((row) => {
          const cnt = Number(row.star_rating_count ?? 0);
          return {
            id: row.id,
            meme_image_url: row.meme_image_url,
            original_image_url: row.original_image_url,
            original_image_url_2: row.original_image_url_2 ?? null,
            created_at: row.created_at,
            star_rating_avg:
              row.star_rating_avg != null ? Number(row.star_rating_avg) : null,
            star_rating_count: Number.isFinite(cnt) ? cnt : 0,
            my_star_rating: null,
          };
        });

        const postsWithUrls: PostThumb[] = posts.map((p) => {
          const { thumb_url, full_fallback_url } = resolvePostGridThumbUrls(
            p.meme_image_url,
            p.original_image_url,
          );
          const originalSignedUrls = [
            resolvePostMediaPublicUrl(p.original_image_url, "full"),
            ...(p.original_image_url_2
              ? [resolvePostMediaPublicUrl(p.original_image_url_2, "full")]
              : []),
          ].filter((url): url is string => Boolean(url));
          return {
            ...p,
            signed_url: thumb_url,
            full_fallback_url,
            original_signed_url: originalSignedUrls[0] ?? null,
            original_signed_urls: originalSignedUrls,
          };
        });

        setResult((prev) => {
          const nextPosts =
            append && prev?.projectId === projectId
              ? [...prev.posts, ...postsWithUrls]
              : postsWithUrls;
          return {
            projectId,
            posts: nextPosts,
            error: null,
            page: targetPage,
            hasMore: rows.length === GRID_PAGE_SIZE,
          };
        });

        if (postIds.length > 0) {
          void fetchMyStarRatingsForPostIds(
            supabase,
            currentUserId,
            postIds,
          ).then((myStars) => {
            setResult((prev) => {
              if (!prev || prev.projectId !== projectId) return prev;
              const idSet = new Set(postIds);
              return {
                ...prev,
                posts: prev.posts.map((post) =>
                  idSet.has(post.id)
                    ? {
                        ...post,
                        my_star_rating: myStars.get(post.id) ?? null,
                      }
                    : post,
                ),
              };
            });
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [userId, currentUserId],
  );

  const handleLoadMore = useCallback(() => {
    if (!activeProjectId) return;
    if (!result?.hasMore) return;
    startLoadMoreTransition(() => {
      void loadPosts(activeProjectId, (result?.page ?? 0) + 1, true);
    });
  }, [activeProjectId, loadPosts, result?.hasMore, result?.page]);

  const loadMoreSentinelRef = useLoadMoreOnIntersect(
    Boolean(activeProjectId && result?.hasMore && (result?.posts.length ?? 0) > 0),
    Boolean(result?.hasMore),
    isLoading || isLoadingMore,
    handleLoadMore,
  );

  useEffect(() => {
    if (!activeProjectId) return;
    setResult(null);
    void loadPosts(activeProjectId, 0, false);
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

  const initialLoading = result === null || result.projectId !== activeProjectId;
  if (initialLoading) {
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
          const isDeleting = deletingId === post.id;
          const isPending = !post.meme_image_url;

          return (
            <div
              key={post.id}
              className="group flex flex-col overflow-hidden rounded-md border border-zinc-800/80 bg-zinc-800 shadow-sm"
            >
              <div className="relative aspect-[2/3] w-full shrink-0 bg-zinc-900/40">
                {post.signed_url || post.full_fallback_url ? (
                  <GridPostThumbnail
                    key={`${post.id}:${post.signed_url ?? ""}`}
                    thumbSrc={post.signed_url}
                    fallbackSrc={post.full_fallback_url}
                    alt="Post"
                    onClick={() => openPostDetail(post.id)}
                    className="absolute inset-0 h-full w-full cursor-pointer object-cover transition-opacity active:opacity-75"
                    dimmed={isPending}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                {(post.signed_url || post.full_fallback_url) && (
                  <PostRemixButton postId={post.id} />
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
                    className="absolute left-1 top-1 z-20 flex h-7 w-7 touch-manipulation items-center justify-center rounded-full bg-zinc-950/75 text-zinc-200 shadow-md ring-1 ring-white/10 transition-colors hover:bg-red-600/90 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
                {isPending && (
                  <span className="absolute bottom-1 left-1 z-10 rounded bg-zinc-800/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                    in Arbeit
                  </span>
                )}
              </div>

              <div className="flex shrink-0 justify-center border-t border-zinc-700/80 bg-zinc-900/95 px-1 py-1.5">
                {post.meme_image_url ? (
                  <div
                    className="flex justify-center"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <PostStarRating
                      postId={post.id}
                      starRatingAvg={post.star_rating_avg}
                      starRatingCount={post.star_rating_count}
                      myStarRating={post.my_star_rating}
                      interactive
                      compact
                      className="justify-center gap-0"
                      onUpdated={(v: PostStarRatingSnapshot) => {
                        setResult((prev) =>
                          prev
                            ? {
                                ...prev,
                                posts: prev.posts.map((x) =>
                                  x.id === post.id
                                    ? {
                                        ...x,
                                        star_rating_avg: v.star_rating_avg,
                                        star_rating_count: v.star_rating_count,
                                        my_star_rating: v.my_star_rating,
                                      }
                                    : x,
                                ),
                              }
                            : prev,
                        );
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {result.hasMore && result.posts.length > 0 && (
        <div className="mt-4 flex flex-col items-center px-2 pb-2">
          <div ref={loadMoreSentinelRef} className="h-2 w-full" aria-hidden />
          {(isLoadingMore || isLoading) && (
            <div className="flex h-10 items-center gap-2 text-sm text-zinc-400" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Lädt…
            </div>
          )}
        </div>
      )}

      <ProfilePostDetailSheet
        postId={detailPostId}
        fallbackImageSrc={detailFallbackSrc}
        fallbackOriginalSrc={detailFallbackOriginalSrc}
        currentUserId={currentUserId}
        isAdmin={viewerIsAdmin}
        entryAsLightbox
        onClose={closePostDetail}
        onPostMoved={handlePostMovedFromDetail}
      />
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
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-800 p-6 text-center">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">{description}</p>
    </div>
  );
}
