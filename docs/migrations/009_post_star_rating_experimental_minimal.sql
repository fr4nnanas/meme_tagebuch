-- Sterne-Bewertung (1–5, optional, Eigentümer) und Flag für experimentellen KI-Minimal-Stil

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS star_rating SMALLINT
    CHECK (star_rating IS NULL OR (star_rating >= 1 AND star_rating <= 5)),
  ADD COLUMN IF NOT EXISTS ai_experimental_minimal BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.posts.star_rating IS 'Optionale Eigentümer-Bewertung 1–5.';
COMMENT ON COLUMN public.posts.ai_experimental_minimal IS 'Experimenteller Vollbild-KI-Modus: reduzierte Bildelemente.';
