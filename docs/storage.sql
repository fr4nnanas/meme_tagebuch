-- =============================================================
-- Vacation Meme Feed – Supabase Storage Buckets + Policies
-- Ausführen NACH docs/schema.sql
-- =============================================================

-- -------------------------------------------------------------
-- BUCKETS
-- -------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('originals', 'originals', false),
  ('memes', 'memes', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

-- -------------------------------------------------------------
-- EXISTIERENDE POLICIES BEREINIGEN (idempotent)
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Avatars sind öffentlich lesbar" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Upload nur eigener Ordner" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Update nur eigener Ordner" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Delete nur eigener Ordner" ON storage.objects;

DROP POLICY IF EXISTS "Originals lesen nur Projektmitglieder" ON storage.objects;
DROP POLICY IF EXISTS "Originals schreiben nur eigener Unterordner" ON storage.objects;
DROP POLICY IF EXISTS "Originals updaten nur eigener Unterordner" ON storage.objects;
DROP POLICY IF EXISTS "Originals löschen nur eigener Unterordner" ON storage.objects;

DROP POLICY IF EXISTS "Memes lesen nur Projektmitglieder" ON storage.objects;
DROP POLICY IF EXISTS "Memes schreiben nur eigener Unterordner" ON storage.objects;
DROP POLICY IF EXISTS "Memes updaten nur eigener Unterordner" ON storage.objects;
DROP POLICY IF EXISTS "Memes löschen nur eigener Unterordner" ON storage.objects;

-- -------------------------------------------------------------
-- AVATARS (public bucket)
-- Pfad: /{user_id}/avatar.jpg
-- -------------------------------------------------------------
CREATE POLICY "Avatars sind öffentlich lesbar"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Avatar Upload nur eigener Ordner"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "Avatar Update nur eigener Ordner"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "Avatar Delete nur eigener Ordner"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- -------------------------------------------------------------
-- ORIGINALS (private bucket)
-- Pfad: /{project_id}/{user_id}/{post_id}.jpg
-- -------------------------------------------------------------
CREATE POLICY "Originals lesen nur Projektmitglieder"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'originals'
  AND (
    public.is_admin()
    OR public.is_project_member(split_part(name, '/', 1)::uuid)
  )
);

CREATE POLICY "Originals schreiben nur eigener Unterordner"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'originals'
  AND auth.role() = 'authenticated'
  AND (
    public.is_admin()
    OR (
      public.is_project_member(split_part(name, '/', 1)::uuid)
      AND split_part(name, '/', 2) = auth.uid()::text
    )
  )
);

CREATE POLICY "Originals updaten nur eigener Unterordner"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'originals'
  AND auth.role() = 'authenticated'
  AND (
    public.is_admin()
    OR (
      public.is_project_member(split_part(name, '/', 1)::uuid)
      AND split_part(name, '/', 2) = auth.uid()::text
    )
  )
)
WITH CHECK (
  bucket_id = 'originals'
  AND auth.role() = 'authenticated'
  AND (
    public.is_admin()
    OR (
      public.is_project_member(split_part(name, '/', 1)::uuid)
      AND split_part(name, '/', 2) = auth.uid()::text
    )
  )
);

CREATE POLICY "Originals löschen nur eigener Unterordner"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'originals'
  AND auth.role() = 'authenticated'
  AND (
    public.is_admin()
    OR (
      public.is_project_member(split_part(name, '/', 1)::uuid)
      AND split_part(name, '/', 2) = auth.uid()::text
    )
  )
);

-- -------------------------------------------------------------
-- MEMES (private bucket)
-- Pfad: /{project_id}/{user_id}/{post_id}.jpg
-- -------------------------------------------------------------
CREATE POLICY "Memes lesen nur Projektmitglieder"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'memes'
  AND (
    public.is_admin()
    OR public.is_project_member(split_part(name, '/', 1)::uuid)
  )
);

CREATE POLICY "Memes schreiben nur eigener Unterordner"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'memes'
  AND auth.role() = 'authenticated'
  AND (
    public.is_admin()
    OR (
      public.is_project_member(split_part(name, '/', 1)::uuid)
      AND split_part(name, '/', 2) = auth.uid()::text
    )
  )
);

CREATE POLICY "Memes updaten nur eigener Unterordner"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'memes'
  AND auth.role() = 'authenticated'
  AND (
    public.is_admin()
    OR (
      public.is_project_member(split_part(name, '/', 1)::uuid)
      AND split_part(name, '/', 2) = auth.uid()::text
    )
  )
)
WITH CHECK (
  bucket_id = 'memes'
  AND auth.role() = 'authenticated'
  AND (
    public.is_admin()
    OR (
      public.is_project_member(split_part(name, '/', 1)::uuid)
      AND split_part(name, '/', 2) = auth.uid()::text
    )
  )
);

CREATE POLICY "Memes löschen nur eigener Unterordner"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'memes'
  AND auth.role() = 'authenticated'
  AND (
    public.is_admin()
    OR (
      public.is_project_member(split_part(name, '/', 1)::uuid)
      AND split_part(name, '/', 2) = auth.uid()::text
    )
  )
);
