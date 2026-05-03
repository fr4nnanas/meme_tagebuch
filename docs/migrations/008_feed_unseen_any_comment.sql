-- „Verpasste Memes“: Post erscheint wieder, sobald **irgendein** neuer Kommentar
-- nach dem letzten „gesehen“ (post_views.viewed_at) existiert — für alle Nutzer
-- gleichermaßen (kein Ausschluss des eigenen Kommentars).

CREATE OR REPLACE FUNCTION public.feed_unseen_posts_page(
  p_project_id UUID,
  p_limit INT DEFAULT 10,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  project_id UUID,
  caption TEXT,
  meme_image_url TEXT,
  meme_type TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.user_id, p.project_id, p.caption, p.meme_image_url, p.meme_type, p.created_at
  FROM public.posts p
  WHERE p.project_id = p_project_id
    AND p.meme_image_url IS NOT NULL
    AND public.is_project_member(p_project_id)
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.post_views v
        WHERE v.post_id = p.id AND v.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.comments c
        INNER JOIN public.post_views v ON v.post_id = c.post_id AND v.user_id = auth.uid()
        WHERE c.post_id = p.id
          AND c.created_at > v.viewed_at
      )
    )
  ORDER BY GREATEST(
    p.created_at,
    COALESCE(
      (
        SELECT MAX(c.created_at)
        FROM public.comments c
        WHERE c.post_id = p.id
      ),
      to_timestamp(0)
    )
  ) DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION public.feed_unseen_count(p_project_id UUID)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM public.posts p
  WHERE p.project_id = p_project_id
    AND p.meme_image_url IS NOT NULL
    AND public.is_project_member(p_project_id)
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.post_views v
        WHERE v.post_id = p.id AND v.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.comments c
        INNER JOIN public.post_views v ON v.post_id = c.post_id AND v.user_id = auth.uid()
        WHERE c.post_id = p.id
          AND c.created_at > v.viewed_at
      )
    );
$$;

REVOKE ALL ON FUNCTION public.feed_unseen_posts_page(UUID, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feed_unseen_posts_page(UUID, INT, INT) TO authenticated;

REVOKE ALL ON FUNCTION public.feed_unseen_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feed_unseen_count(UUID) TO authenticated;
