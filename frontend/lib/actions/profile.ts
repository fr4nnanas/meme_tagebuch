"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
