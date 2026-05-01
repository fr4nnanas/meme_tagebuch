-- Migration 002: ai_prompt_context zu projects hinzufügen
-- Im Supabase SQL-Editor ausführen

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS ai_prompt_context TEXT;

COMMENT ON COLUMN public.projects.ai_prompt_context
  IS 'Optionaler Kontext/Masterprompt für KI-Meme-Generierung in diesem Projekt';
