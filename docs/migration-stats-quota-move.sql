-- Migration: Meme-Statistik pro Projekt (Quota), tägliche Nutzung pro Projekt
-- Nach bestehendem schema.sql ausführen.
-- Hinweis: Projektspezifisches KI-Limit je Projekt → Spalte projects.daily_ai_generated_limit
-- (Migration docs/migrations/010_project_daily_ai_generated_limit.sql).

CREATE TABLE IF NOT EXISTS public.daily_usage_project (
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  ai_images_used INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, project_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_usage_project_date
  ON public.daily_usage_project (date);

ALTER TABLE public.daily_usage_project ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User sieht eigene projektbezogene Nutzung"
  ON public.daily_usage_project FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "User trägt eigene projektbezogene Nutzung ein"
  ON public.daily_usage_project FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User aktualisiert eigene projektbezogene Nutzung"
  ON public.daily_usage_project FOR UPDATE
  USING (auth.uid() = user_id);
