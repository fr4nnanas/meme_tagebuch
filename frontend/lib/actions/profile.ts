"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uploadAvatarFromJpegBuffer } from "@/lib/storage/image-pipeline";

export type ProfileActionResult = { error: string } | { success: true };

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const BIO_MAX = 280;

export async function updateProfile(
  formData: FormData,
): Promise<ProfileActionResult> {
  const usernameRaw = String(formData.get("username") ?? "").trim();
  const bioRaw = String(formData.get("bio") ?? "");
  const bio = bioRaw.trim();

  if (usernameRaw.length < USERNAME_MIN) {
    return {
      error: `Benutzername muss mindestens ${USERNAME_MIN} Zeichen lang sein.`,
    };
  }
  if (usernameRaw.length > USERNAME_MAX) {
    return {
      error: `Benutzername darf höchstens ${USERNAME_MAX} Zeichen lang sein.`,
    };
  }
  if (bio.length > BIO_MAX) {
    return { error: `Bio darf höchstens ${BIO_MAX} Zeichen lang sein.` };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Nicht eingeloggt." };
    }

    // Username-Konflikt vorab prüfen (für saubere Fehlermeldung statt 23505)
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", usernameRaw)
      .neq("id", user.id)
      .maybeSingle();

    if (existing) {
      return { error: "Dieser Benutzername ist bereits vergeben." };
    }

    const { error } = await supabase
      .from("users")
      .update({ username: usernameRaw, bio: bio.length > 0 ? bio : null })
      .eq("id", user.id);

    if (error) {
      return { error: "Profil konnte nicht gespeichert werden." };
    }

    revalidatePath(`/profile/${user.id}`);
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Unbekannter Fehler beim Profil-Update.",
    };
  }
}

const AVATAR_MAX_BYTES = 4 * 1024 * 1024;

/** Lädt Avatar nach R2 mit Varianten und speichert den Object-Key in `users.avatar_url`. */
export async function uploadAvatarAction(
  formData: FormData,
): Promise<{ success: true; storageKey: string } | { error: string }> {
  const fileRaw = formData.get("avatar");
  if (!(fileRaw instanceof File) || fileRaw.size <= 0) {
    return { error: "Keine gültige Bilddatei übermittelt." };
  }
  if (fileRaw.size > AVATAR_MAX_BYTES) {
    return { error: "Avatar ist zu groß (max. 4 MB)." };
  }
  if (!fileRaw.type.startsWith("image/")) {
    return { error: "Nur Bilddateien sind erlaubt." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Nicht eingeloggt." };
    }

    const buf = Buffer.from(await fileRaw.arrayBuffer());
    const { storageKey } = await uploadAvatarFromJpegBuffer(user.id, buf);

    const { error } = await supabase
      .from("users")
      .update({ avatar_url: storageKey })
      .eq("id", user.id);

    if (error) {
      return { error: "Avatar konnte nicht gespeichert werden." };
    }

    revalidatePath(`/profile/${user.id}`);
    return { success: true, storageKey };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Unbekannter Fehler beim Avatar-Upload.",
    };
  }
}

export async function updateAvatarUrl(
  avatarUrl: string,
): Promise<ProfileActionResult> {
  if (!avatarUrl) {
    return { error: "Avatar-URL fehlt." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Nicht eingeloggt." };
    }

    const { error } = await supabase
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id);

    if (error) {
      return { error: "Avatar konnte nicht gespeichert werden." };
    }

    revalidatePath(`/profile/${user.id}`);
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Unbekannter Fehler beim Avatar-Update.",
    };
  }
}
