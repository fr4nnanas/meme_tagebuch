"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true };

export async function login(formData: FormData): Promise<ActionResult> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Benutzername und Passwort sind erforderlich." };
  }

  try {
    const supabase = await createClient();

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (profileError || !profile) {
      return { error: "Benutzername oder Passwort ist falsch." };
    }

    const adminClient = createServiceRoleClient();
    const { data: authUserData, error: lookupError } =
      await adminClient.auth.admin.getUserById(profile.id);

    const email = authUserData?.user?.email ?? null;
    if (lookupError || !email) {
      return { error: "Benutzername oder Passwort ist falsch." };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: "Benutzername oder Passwort ist falsch." };
    }
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Unbekannter Fehler beim Login.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/feed");
}

export async function register(formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const usernameRaw = String(formData.get("username") ?? "");
  const username = usernameRaw.trim();
  const token = String(formData.get("token") ?? "").trim();

  if (!password || !username || !token) {
    return { error: "Alle Felder müssen ausgefüllt sein." };
  }

  if (username.length < 3) {
    return { error: "Benutzername muss mindestens 3 Zeichen lang sein." };
  }

  if (password.length < 6) {
    return { error: "Passwort muss mindestens 6 Zeichen lang sein." };
  }

  try {
    const adminClient = createServiceRoleClient();

    const { data: tokenRow, error: tokenError } = await adminClient
      .from("invitation_tokens")
      .select("id")
      .eq("token", token)
      .maybeSingle();

    if (tokenError) {
      return { error: "Token-Prüfung fehlgeschlagen." };
    }
    if (!tokenRow) {
      return { error: "Einladungstoken ist ungültig." };
    }

    const { data: nameTaken } = await adminClient
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (nameTaken) {
      return { error: "Dieser Benutzername ist bereits vergeben." };
    }

    const internalEmail = internalEmailFromUsername(username);

    const { error: createErr } = await adminClient.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (createErr) {
      const msg = createErr.message.toLowerCase();
      if (
        msg.includes("already registered") ||
        msg.includes("already been registered") ||
        msg.includes("user already registered")
      ) {
        return { error: "Dieser Benutzername ist bereits vergeben." };
      }
      return { error: "Registrierung fehlgeschlagen: " + createErr.message };
    }

    const supabase = await createClient();
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password,
    });

    if (signInErr) {
      return {
        error:
          "Konto wurde angelegt, die automatische Anmeldung ist fehlgeschlagen. Bitte auf der Login-Seite einloggen.",
      };
    }
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Unbekannter Fehler bei der Registrierung.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/feed");
}

/** Interne Platzhalter-E-Mail für Supabase Auth (aus Benutzername abgeleitet, kein echtes Postfach). */
function internalEmailFromUsername(username: string): string {
  const key = username.normalize("NFKC").trim();
  const hash = createHash("sha256").update(key, "utf8").digest("hex");
  return `u-${hash}@noreply.invalid`;
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
