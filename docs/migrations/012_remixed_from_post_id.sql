ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS remixed_from_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.posts.remixed_from_post_id IS
  'Quell-Post bei Remix (Attribution / Nachvollziehbarkeit).';

CREATE INDEX IF NOT EXISTS idx_posts_remixed_from_post_id
  ON public.posts(remixed_from_post_id)
  WHERE remixed_from_post_id IS NOT NULL;
