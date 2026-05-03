-- „Verpasste Memes“ / Entdeckung: auch Posts einbeziehen, bei denen seit dem letzten
-- „gesehen“ (post_views.viewed_at) neue Kommentare **anderer Nutzer** hinzugekommen sind.
-- Zudem: UPDATE auf post_views für Upsert / „Alles als gesehen“.

DROP POLICY IF EXISTS "post_views_update_own" ON public.post_views;

CREATE POLICY "post_views_update_own"
  ON public.post_views FOR UPDATE
  USING (auth.uid() = user_id);

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
          AND c.user_id <> auth.uid()
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
          AND c.user_id <> auth.uid()
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
          AND c.user_id <> auth.uid()
          AND c.created_at > v.viewed_at
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.feed_mark_all_project_posts_seen(p_project_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n BIGINT;
BEGIN
  IF NOT public.is_project_member(p_project_id) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.post_views (user_id, post_id, viewed_at)
  SELECT auth.uid(), p.id, NOW()
  FROM public.posts p
  WHERE p.project_id = p_project_id
    AND p.meme_image_url IS NOT NULL
  ON CONFLICT (user_id, post_id) DO UPDATE
    SET viewed_at = EXCLUDED.viewed_at;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
