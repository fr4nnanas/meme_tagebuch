-- Sterne: Durchschnitt aller Nutzer (Anzeige gerundet auf ganze Sterne; intern NUMERIC(4,2) für Ranking).
-- Ersetzt die alte Einzel-Spalte posts.star_rating (Eigentümer), falls vorhanden.

-- 1) Bewertungen pro Nutzer und Post
CREATE TABLE IF NOT EXISTS public.post_star_ratings (
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_star_ratings_post_id
  ON public.post_star_ratings(post_id);

COMMENT ON TABLE public.post_star_ratings IS 'Eine Bewertung 1–5 pro Nutzer und Post; Durchschnitt wird auf posts gespiegelt.';

-- 2) Neue aggregierte Spalten auf posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS star_rating_avg NUMERIC(4,2)
    CHECK (star_rating_avg IS NULL OR (star_rating_avg >= 1 AND star_rating_avg <= 5));
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS star_rating_count INT NOT NULL DEFAULT 0
    CHECK (star_rating_count >= 0);

COMMENT ON COLUMN public.posts.star_rating_avg IS 'Durchschnitt aller Sterne (2 Dezimalstellen); Anzeige im Client gerundet.';
COMMENT ON COLUMN public.posts.star_rating_count IS 'Anzahl abgegebener Sterne-Bewertungen.';

-- 3) Legacy: Einzelwert posts.star_rating → eine Zeile als Bewertung des Post-Autors (falls Spalte noch existiert)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'star_rating'
  ) THEN
    INSERT INTO public.post_star_ratings (post_id, user_id, rating)
    SELECT p.id, p.user_id, p.star_rating::smallint
    FROM public.posts p
    WHERE p.star_rating IS NOT NULL
    ON CONFLICT (post_id, user_id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_star_rating_check;
ALTER TABLE public.posts DROP COLUMN IF EXISTS star_rating;

-- 4) Aggregat aus post_star_ratings (Sicherheits-Backfill)
UPDATE public.posts p
SET
  star_rating_count = COALESCE(s.cnt, 0),
  star_rating_avg = s.avg_rounded
FROM (
  SELECT
    post_id,
    COUNT(*)::int AS cnt,
    ROUND(AVG(rating)::numeric, 2) AS avg_rounded
  FROM public.post_star_ratings
  GROUP BY post_id
) s
WHERE p.id = s.post_id;

UPDATE public.posts
SET star_rating_count = 0, star_rating_avg = NULL
WHERE NOT EXISTS (SELECT 1 FROM public.post_star_ratings r WHERE r.post_id = id)
  AND (star_rating_avg IS NOT NULL OR star_rating_count <> 0);

-- 5) Trigger: posts.star_rating_* nach jeder Änderung an post_star_ratings
CREATE OR REPLACE FUNCTION public.post_star_ratings_refresh_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
BEGIN
  pid := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE public.posts p
  SET
    star_rating_count = COALESCE((
      SELECT COUNT(*)::int FROM public.post_star_ratings r WHERE r.post_id = pid
    ), 0),
    star_rating_avg = (
      SELECT ROUND(AVG(r.rating)::numeric, 2)
      FROM public.post_star_ratings r
      WHERE r.post_id = pid
    )
  WHERE p.id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_post_star_ratings_refresh ON public.post_star_ratings;
CREATE TRIGGER tr_post_star_ratings_refresh
AFTER INSERT OR UPDATE OR DELETE ON public.post_star_ratings
FOR EACH ROW
EXECUTE FUNCTION public.post_star_ratings_refresh_post();

-- 6) RLS
ALTER TABLE public.post_star_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Projektmitglieder sehen Sterne-Bewertungen"
  ON public.post_star_ratings FOR SELECT
  USING (
    public.is_project_member((SELECT project_id FROM public.posts WHERE id = post_id))
    OR public.is_admin()
  );

CREATE POLICY "Projektmitglieder können Sterne vergeben"
  ON public.post_star_ratings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_project_member((SELECT project_id FROM public.posts WHERE id = post_id))
  );

CREATE POLICY "Nutzer kann eigene Sterne-Bewertung ändern"
  ON public.post_star_ratings FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Nutzer kann eigene Sterne-Bewertung löschen"
  ON public.post_star_ratings FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());
