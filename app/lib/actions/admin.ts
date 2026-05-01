"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export type AdminActionResult = { error: string } | { success: true };

async function ensureAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Nicht eingeloggt.");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") throw new Error("Kein Admin-Zugriff.");

  return { supabase, userId: user.id };
}

// ----- PROJEKTE -----

export async function createProject(
  formData: FormData,
): Promise<AdminActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) return { error: "Projektname ist erforderlich." };
  if (name.length > 80) return { error: "Projektname ist zu lang (max. 80 Zeichen)." };

  try {
    const { supabase, userId } = await ensureAdmin();

    const { error } = await supabase.from("projects").insert({
      name,
      description: description.length > 0 ? description : null,
      created_by: userId,
    });

    if (error) return { error: "Projekt konnte nicht angelegt werden." };

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unbekannter Fehler." };
  }
}

export async function addProjectMember(
  projectId: string,
  userId: string,
): Promise<AdminActionResult> {
  try {
    const { supabase } = await ensureAdmin();

    const { error } = await supabase.from("project_members").insert({
      project_id: projectId,
      user_id: userId,
    });

    if (error) {
      if (error.code === "23505") return { error: "User ist bereits Mitglied dieses Projekts." };
      return { error: "Mitglied konnte nicht hinzugefügt werden." };
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unbekannter Fehler." };
  }
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
): Promise<AdminActionResult> {
  try {
    const { supabase } = await ensureAdmin();

    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);

    if (error) return { error: "Mitglied konnte nicht entfernt werden." };

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unbekannter Fehler." };
  }
}

export async function deleteProject(
  projectId: string,
): Promise<AdminActionResult> {
  try {
    const { supabase } = await ensureAdmin();

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) return { error: "Projekt konnte nicht gelöscht werden." };

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unbekannter Fehler." };
  }
}

export async function updateProjectBasics(
  projectId: string,
  name: string,
  description: string,
): Promise<AdminActionResult> {
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  if (!trimmedName) return { error: "Projektname ist erforderlich." };
  if (trimmedName.length > 80) return { error: "Projektname ist zu lang (max. 80 Zeichen)." };
  if (trimmedDescription.length > 300) {
    return { error: "Beschreibung ist zu lang (max. 300 Zeichen)." };
  }

  try {
    const { supabase } = await ensureAdmin();

    const { error } = await supabase
      .from("projects")
      .update({
        name: trimmedName,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
      })
      .eq("id", projectId);

    if (error) return { error: "Projekt konnte nicht gespeichert werden." };

    const navPaths = ["/admin", "/feed", "/upload", "/map", "/people"];
    for (const p of navPaths) {
      revalidatePath(p);
    }

    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unbekannter Fehler." };
  }
}

function formatPromptContextSaveError(
  error: { message: string; code?: string },
): string {
  const msg = error.message.toLowerCase();
  const code = error.code ?? "";

  if (
    code === "42703" ||
    msg.includes("ai_prompt_context") ||
    (msg.includes("column") &&
      (msg.includes("does not exist") ||
        msg.includes("unknown"))) ||
    msg.includes("schema cache")
  ) {
    return (
      "Die Datenbank-Spalte „ai_prompt_context“ gibt es noch nicht oder der Schema-Cache ist veraltet. " +
      "Im Supabase-Dashboard unter SQL diese Zeilen ausführen: ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS ai_prompt_context TEXT; — " +
      "Details siehe docs/migrations/002_add_ai_prompt_context.sql."
    );
  }

  if (
    code === "42501" ||
    msg.includes("row-level security") ||
    msg.includes("permission denied")
  ) {
    return (
      "Speichern abgelehnt (Zugriffsregeln): Prüfe, ob dein Account in „users“ als admin eingetragen ist."
    );
  }

  return `Kontext konnte nicht gespeichert werden: ${error.message}`;
}

export async function updateProjectPromptContext(
  projectId: string,
  promptContext: string,
): Promise<AdminActionResult> {
  const trimmed = promptContext.trim();
  if (trimmed.length > 1000) {
    return { error: "Kontext ist zu lang (max. 1000 Zeichen)." };
  }

  try {
    const { supabase } = await ensureAdmin();

    const { error } = await supabase
      .from("projects")
      .update({ ai_prompt_context: trimmed.length > 0 ? trimmed : null })
      .eq("id", projectId);

    if (error) return { error: formatPromptContextSaveError(error) };

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unbekannter Fehler." };
  }
}

// ----- EINLADUNGSLINKS -----

export async function generateInvitationToken(): Promise<AdminActionResult> {
  try {
    const { supabase, userId } = await ensureAdmin();

    const { error } = await supabase.from("invitation_tokens").insert({
      created_by: userId,
    });

    if (error) return { error: "Token konnte nicht generiert werden." };

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unbekannter Fehler." };
  }
}

export async function deleteInvitationToken(
  tokenId: string,
): Promise<AdminActionResult> {
  try {
    const { supabase } = await ensureAdmin();

    const { error } = await supabase
      .from("invitation_tokens")
      .delete()
      .eq("id", tokenId);

    if (error) return { error: "Token konnte nicht gelöscht werden." };

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unbekannter Fehler." };
  }
}

// ----- USER-VERWALTUNG -----

export async function setUserRole(
  targetUserId: string,
  role: "admin" | "member",
): Promise<AdminActionResult> {
  try {
    const { supabase, userId } = await ensureAdmin();

    // Eigene Admin-Rolle kann nicht entzogen werden
    if (targetUserId === userId && role === "member") {
      return { error: "Du kannst dir selbst die Admin-Rolle nicht entziehen." };
    }

    const { error } = await supabase
      .from("users")
      .update({ role })
      .eq("id", targetUserId);

    if (error) return { error: "Rolle konnte nicht geändert werden." };

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unbekannter Fehler." };
  }
}

export async function deleteUser(
  targetUserId: string,
): Promise<AdminActionResult> {
  try {
    const { userId } = await ensureAdmin();

    if (targetUserId === userId) {
      return { error: "Du kannst deinen eigenen Account nicht löschen." };
    }

    // Auth-User löschen – kaskadiert auf public.users und alle verknüpften Daten
    const adminClient = createServiceRoleClient();
    const { error } = await adminClient.auth.admin.deleteUser(targetUserId);

    if (error) return { error: "User konnte nicht gelöscht werden." };

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unbekannter Fehler." };
  }
}

// ----- KI-LIMIT -----

export async function updateAiLimit(
  limit: number,
): Promise<AdminActionResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return { error: "Limit muss eine ganze Zahl zwischen 1 und 100 sein." };
  }

  try {
    const { supabase } = await ensureAdmin();

    const { error } = await supabase
      .from("settings")
      .update({ value: String(limit), updated_at: new Date().toISOString() })
      .eq("key", "daily_ai_image_limit");

    if (error) return { error: "Limit konnte nicht gespeichert werden." };

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unbekannter Fehler." };
  }
}
