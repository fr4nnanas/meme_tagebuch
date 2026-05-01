-- Pipeline "manual": Text-Overlay ohne KI, Nutzertext 1:1
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_pipeline_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_pipeline_check
  CHECK (pipeline IN ('direct', 'assisted', 'manual'));
