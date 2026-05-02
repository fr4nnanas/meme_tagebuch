-- Standard-Projekt („Lobby“): neue Nutzer werden automatisch Mitglied
INSERT INTO public.settings (key, value)
VALUES ('default_member_project_id', '')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Nur Admin kann Settings einfügen" ON public.settings;
CREATE POLICY "Nur Admin kann Settings einfügen" ON public.settings
  FOR INSERT WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  lobby_raw text;
  lobby_id uuid;
BEGIN
  INSERT INTO public.users (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    CASE WHEN (SELECT COUNT(*) FROM public.users) = 0 THEN 'admin' ELSE 'member' END
  );

  SELECT s.value INTO lobby_raw
  FROM public.settings s
  WHERE s.key = 'default_member_project_id';

  IF lobby_raw IS NOT NULL AND btrim(lobby_raw) <> '' THEN
    BEGIN
      lobby_id := lobby_raw::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        lobby_id := NULL;
    END;

    IF lobby_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = lobby_id
    ) THEN
      INSERT INTO public.project_members (user_id, project_id)
      VALUES (NEW.id, lobby_id)
      ON CONFLICT (user_id, project_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
