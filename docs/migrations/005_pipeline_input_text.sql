-- Gespeicherter Nutzertext / Kontext pro Post (für Retry mit vorausgefülltem Prompt)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS pipeline_input_text TEXT;

COMMENT ON COLUMN public.posts.pipeline_input_text IS
  'Effektiver Nutzertext zum Zeitpunkt des Starts (Idee, Stichworte, manueller Text); für Retry/Wiederholung.';
