-- =============================================================
-- Vacation Meme Feed – Verifikation für Paket 2
-- Nach docs/schema.sql und docs/storage.sql ausführen
-- =============================================================

-- 1) Tabellen prüfen
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users',
    'projects',
    'project_members',
    'posts',
    'jobs',
    'comments',
    'post_likes',
    'comment_likes',
    'invitation_tokens',
    'settings',
    'daily_usage'
  )
ORDER BY table_name;

-- 2) RLS-Status prüfen
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'users',
    'projects',
    'project_members',
    'posts',
    'jobs',
    'comments',
    'post_likes',
    'comment_likes',
    'invitation_tokens',
    'settings',
    'daily_usage'
  )
ORDER BY tablename;

-- 3) Buckets prüfen
SELECT id, name, public
FROM storage.buckets
WHERE id IN ('avatars', 'originals', 'memes')
ORDER BY id;

-- 4) Storage-Policies prüfen
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
    'Avatars sind öffentlich lesbar',
    'Avatar Upload nur eigener Ordner',
    'Avatar Update nur eigener Ordner',
    'Avatar Delete nur eigener Ordner',
    'Originals lesen nur Projektmitglieder',
    'Originals schreiben nur eigener Unterordner',
    'Originals updaten nur eigener Unterordner',
    'Originals löschen nur eigener Unterordner',
    'Memes lesen nur Projektmitglieder',
    'Memes schreiben nur eigener Unterordner',
    'Memes updaten nur eigener Unterordner',
    'Memes löschen nur eigener Unterordner'
  )
ORDER BY policyname;
