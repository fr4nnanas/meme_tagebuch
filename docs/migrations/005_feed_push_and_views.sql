-- Feed: „gesehen“-Tracking, Web-Push-Abos und Benachrichtigungseinstellungen
-- Im Supabase SQL-Editor nach bestehendem Schema ausführen.

CREATE TABLE public.post_views (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_post_views_post_id ON public.post_views(post_id);

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

CREATE TABLE public.user_feed_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  include_own_posts BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feed_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_views_select_own"
  ON public.post_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "post_views_insert_own"
  ON public.post_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_select_own"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_insert_own"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_update_own"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_delete_own"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "user_feed_notification_settings_select_own"
  ON public.user_feed_notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_feed_notification_settings_insert_own"
  ON public.user_feed_notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_feed_notification_settings_update_own"
  ON public.user_feed_notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Paginierte „noch nicht gesehen“-Posts (für Entdeckung/Inbox)
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
    AND NOT EXISTS (
      SELECT 1 FROM public.post_views v
      WHERE v.post_id = p.id AND v.user_id = auth.uid()
    )
  ORDER BY p.created_at DESC
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
    AND NOT EXISTS (
      SELECT 1 FROM public.post_views v
      WHERE v.post_id = p.id AND v.user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.feed_unseen_posts_page(UUID, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feed_unseen_posts_page(UUID, INT, INT) TO authenticated;

REVOKE ALL ON FUNCTION public.feed_unseen_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feed_unseen_count(UUID) TO authenticated;

-- Web-Push (VAPID): Schlüssel z. B. generieren mit
--   cd frontend && npx web-push generate-vapid-keys
-- Dann NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, optional VAPID_SUBJECT (mailto:…) setzen.
