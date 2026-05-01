-- =============================================================
-- Vacation Meme Feed – Supabase Datenbankschema
-- Diesen SQL-Code im Supabase SQL-Editor ausführen.
-- Danach: RLS-Policies im zweiten Block ausführen.
-- =============================================================

-- Erweiterungen aktivieren
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================
-- TABELLEN
-- =============================================================

-- Nutzerprofil (erweitert Supabase auth.users)
CREATE TABLE public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  bio         TEXT,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projekte (= Urlaube)
CREATE TABLE public.projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  created_by  UUID NOT NULL REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projekt-Mitgliedschaften (viele-zu-viele: User <-> Projekte)
CREATE TABLE public.project_members (
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

-- Posts (Memes im Feed)
CREATE TABLE public.posts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id          UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- Bild-URLs (Supabase Storage Pfade)
  original_image_url  TEXT NOT NULL,
  meme_image_url      TEXT,                  -- NULL solange Job noch läuft
  -- Meme-Typ: 'ai_generated' (gpt-image-2) oder 'canvas_overlay' (Canvas + gpt-4o Text)
  meme_type           TEXT NOT NULL CHECK (meme_type IN ('ai_generated', 'canvas_overlay')),
  -- Canvas-Overlay Texte (nur relevant wenn meme_type = 'canvas_overlay')
  overlay_text_top    TEXT,
  overlay_text_bottom TEXT,
  -- Pipeline: 'direct' (Pipeline A) oder 'assisted' (Pipeline B)
  pipeline            TEXT NOT NULL CHECK (pipeline IN ('direct', 'assisted')),
  -- Caption (manuell oder KI-generiert, nachträglich editierbar)
  caption             TEXT,
  -- GPS-Koordinaten aus EXIF-Daten (können NULL sein wenn kein GPS im Foto)
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asynchrone KI-Jobs
CREATE TABLE public.jobs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_msg   TEXT,                          -- Fehlermeldung bei status = 'failed'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kommentare
CREATE TABLE public.comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Likes auf Posts
CREATE TABLE public.post_likes (
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- Likes auf Kommentare
CREATE TABLE public.comment_likes (
  comment_id  UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

-- Einladungslinks (Token-basiert, kein Ablauf, mehrfach nutzbar)
CREATE TABLE public.invitation_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by  UUID NOT NULL REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- App-weite Einstellungen (Key-Value, nur Admin kann schreiben)
CREATE TABLE public.settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default-Einstellungen einfügen
INSERT INTO public.settings (key, value) VALUES
  ('daily_ai_image_limit', '5'),       -- Typ-A Meme-Generierungen pro User pro Tag
  ('app_name', 'Vacation Meme Feed');  -- App-Name (für Export, UI)

-- Tägliche KI-Nutzung pro User tracken
CREATE TABLE public.daily_usage (
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  ai_images_used INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);


-- =============================================================
-- INDIZES (für Performance)
-- =============================================================

CREATE INDEX idx_posts_project_id     ON public.posts(project_id);
CREATE INDEX idx_posts_user_id        ON public.posts(user_id);
CREATE INDEX idx_posts_created_at     ON public.posts(created_at DESC);
CREATE INDEX idx_posts_lat_lng        ON public.posts(lat, lng) WHERE lat IS NOT NULL;
CREATE INDEX idx_comments_post_id     ON public.comments(post_id);
CREATE INDEX idx_project_members_uid  ON public.project_members(user_id);
CREATE INDEX idx_project_members_pid  ON public.project_members(project_id);
CREATE INDEX idx_jobs_user_id         ON public.jobs(user_id);
CREATE INDEX idx_jobs_status          ON public.jobs(status);


-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================

-- RLS auf allen Tabellen aktivieren
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage       ENABLE ROW LEVEL SECURITY;


-- Helper-Funktion: Prüft ob aktueller User Admin ist
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper-Funktion: Prüft ob User Mitglied eines Projekts ist
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = auth.uid() AND project_id = p_project_id
  );
$$ LANGUAGE sql SECURITY DEFINER;


-- --- USERS ---
CREATE POLICY "User kann eigenes Profil lesen"       ON public.users FOR SELECT USING (true);
CREATE POLICY "User kann eigenes Profil bearbeiten"  ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin kann alle User bearbeiten"      ON public.users FOR UPDATE USING (public.is_admin());
CREATE POLICY "Nur System kann User anlegen"         ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- --- PROJECTS ---
CREATE POLICY "Nur Mitglieder sehen ihre Projekte"   ON public.projects FOR SELECT USING (public.is_project_member(id) OR public.is_admin());
CREATE POLICY "Nur Admin kann Projekte anlegen"      ON public.projects FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Nur Admin kann Projekte bearbeiten"   ON public.projects FOR UPDATE USING (public.is_admin());
CREATE POLICY "Nur Admin kann Projekte löschen"      ON public.projects FOR DELETE USING (public.is_admin());

-- --- PROJECT_MEMBERS ---
CREATE POLICY "Mitglieder sehen Mitgliedschaften ihres Projekts"
  ON public.project_members FOR SELECT
  USING (public.is_project_member(project_id) OR public.is_admin());
CREATE POLICY "Nur Admin kann Mitglieder hinzufügen" ON public.project_members FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Nur Admin kann Mitglieder entfernen"  ON public.project_members FOR DELETE USING (public.is_admin());

-- --- POSTS ---
CREATE POLICY "Nur Projektmitglieder sehen Posts"
  ON public.posts FOR SELECT
  USING (public.is_project_member(project_id) OR public.is_admin());
CREATE POLICY "Projektmitglieder können Posts erstellen"
  ON public.posts FOR INSERT
  WITH CHECK (public.is_project_member(project_id) AND auth.uid() = user_id);
CREATE POLICY "User kann eigene Posts löschen"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "User kann eigene Posts bearbeiten"
  ON public.posts FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin());

-- --- JOBS ---
CREATE POLICY "User sieht eigene Jobs"               ON public.jobs FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "User kann eigene Jobs anlegen"        ON public.jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System kann Jobs aktualisieren"       ON public.jobs FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

-- --- COMMENTS ---
CREATE POLICY "Projektmitglieder sehen Kommentare"
  ON public.comments FOR SELECT
  USING (public.is_project_member((SELECT project_id FROM public.posts WHERE id = post_id)) OR public.is_admin());
CREATE POLICY "Projektmitglieder können kommentieren"
  ON public.comments FOR INSERT
  WITH CHECK (public.is_project_member((SELECT project_id FROM public.posts WHERE id = post_id)) AND auth.uid() = user_id);
CREATE POLICY "User kann eigene Kommentare löschen"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- --- POST_LIKES ---
CREATE POLICY "Projektmitglieder sehen Post-Likes"
  ON public.post_likes FOR SELECT
  USING (public.is_project_member((SELECT project_id FROM public.posts WHERE id = post_id)) OR public.is_admin());
CREATE POLICY "Projektmitglieder können liken"
  ON public.post_likes FOR INSERT
  WITH CHECK (public.is_project_member((SELECT project_id FROM public.posts WHERE id = post_id)) AND auth.uid() = user_id);
CREATE POLICY "User kann eigene Likes entfernen"
  ON public.post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- --- COMMENT_LIKES ---
CREATE POLICY "Mitglieder sehen Kommentar-Likes"
  ON public.comment_likes FOR SELECT
  USING (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.comments c
    JOIN public.posts p ON p.id = c.post_id
    WHERE c.id = comment_id AND public.is_project_member(p.project_id)
  ));
CREATE POLICY "Mitglieder können Kommentare liken"
  ON public.comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.comments c
    JOIN public.posts p ON p.id = c.post_id
    WHERE c.id = comment_id AND public.is_project_member(p.project_id)
  ));
CREATE POLICY "User kann eigene Kommentar-Likes entfernen"
  ON public.comment_likes FOR DELETE
  USING (auth.uid() = user_id);

-- --- INVITATION_TOKENS ---
CREATE POLICY "Nur Admin sieht Tokens"               ON public.invitation_tokens FOR SELECT USING (public.is_admin());
CREATE POLICY "Nur Admin erstellt Tokens"            ON public.invitation_tokens FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Nur Admin löscht Tokens"              ON public.invitation_tokens FOR DELETE USING (public.is_admin());

-- --- SETTINGS ---
CREATE POLICY "Alle können Settings lesen"           ON public.settings FOR SELECT USING (true);
CREATE POLICY "Nur Admin kann Settings ändern"       ON public.settings FOR UPDATE USING (public.is_admin());

-- --- DAILY_USAGE ---
CREATE POLICY "User sieht eigene Nutzung"            ON public.daily_usage FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "System kann Nutzung eintragen"        ON public.daily_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System kann Nutzung aktualisieren"    ON public.daily_usage FOR UPDATE USING (auth.uid() = user_id);


-- =============================================================
-- SUPABASE AUTH TRIGGER
-- Legt automatisch einen users-Eintrag an, wenn ein neuer
-- Auth-User via Supabase registriert wird.
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    -- Erster User wird Admin
    CASE WHEN (SELECT COUNT(*) FROM public.users) = 0 THEN 'admin' ELSE 'member' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
