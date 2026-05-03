-- Markiert alle veröffentlichten Memes eines Projekts für den aktuellen Nutzer als gesehen.
-- Ausführen, wenn 005_feed_push_and_views.sql bereits angewendet wurde.

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
    AND NOT EXISTS (
      SELECT 1 FROM public.post_views v
      WHERE v.post_id = p.id AND v.user_id = auth.uid()
    )
  ON CONFLICT (user_id, post_id) DO NOTHING;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.feed_mark_all_project_posts_seen(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feed_mark_all_project_posts_seen(UUID) TO authenticated;
