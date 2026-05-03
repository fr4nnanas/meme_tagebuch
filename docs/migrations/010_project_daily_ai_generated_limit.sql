-- Pro Projekt: eigenes Tageslimit für KI-Vollbilder (Typ A) pro Nutzer.
-- Optional nach docs/migration-stats-quota-move.sql ausführen.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS daily_ai_generated_limit INT NOT NULL DEFAULT 5;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_daily_ai_generated_limit_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_daily_ai_generated_limit_check
  CHECK (daily_ai_generated_limit >= 1 AND daily_ai_generated_limit <= 100);

-- Einmaliger Wert aus altem globalen Setting (alle Projekte gleich), falls vorhanden
UPDATE public.projects
SET daily_ai_generated_limit = sub.lim
FROM (
  SELECT (trim(value))::int AS lim
  FROM public.settings
  WHERE key = 'daily_ai_image_limit_per_project'
    AND trim(value) ~ '^[0-9]+$'
  LIMIT 1
) sub
WHERE sub.lim BETWEEN 1 AND 100;

DELETE FROM public.settings WHERE key = 'daily_ai_image_limit_per_project';
