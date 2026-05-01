/**
 * Legt bei leerer DB einen ersten Admin an (Auth + Trigger public.users)
 * und erzeugt einen Eintrag in invitation_tokens.
 *
 * Ausführen aus app/:
 *   node --env-file=.env.local scripts/seed-invitation-token.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen in .env.local gesetzt sein.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const seedEmail =
  process.env.SEED_ADMIN_EMAIL ?? "bootstrap-admin@example.local";
const seedPassword =
  process.env.SEED_ADMIN_PASSWORD ?? "BootstrapDevChangeMe123!";
const seedUsername =
  process.env.SEED_ADMIN_USERNAME ?? "bootstrap_admin";

async function main() {
  const { data: existingUsers, error: usersErr } = await supabase
    .from("users")
    .select("id")
    .limit(1);

  if (usersErr) {
    console.error("users lesen fehlgeschlagen:", usersErr.message);
    process.exit(1);
  }

  let createdBy;

  if (existingUsers?.length) {
    createdBy = existingUsers[0].id;
    console.log("Vorhandenen User als created_by verwendet:", createdBy);
  } else {
    console.log("Keine public.users – lege Bootstrap-Admin an …");
    const { data: created, error: createErr } =
      await supabase.auth.admin.createUser({
        email: seedEmail,
        password: seedPassword,
        email_confirm: true,
        user_metadata: { username: seedUsername },
      });

    if (createErr) {
      console.error("Auth-User anlegen fehlgeschlagen:", createErr.message);
      process.exit(1);
    }

    createdBy = created.user.id;

    const { data: profile, error: profileErr } = await supabase
      .from("users")
      .select("id, username, role")
      .eq("id", createdBy)
      .maybeSingle();

    if (profileErr || !profile) {
      console.error(
        "public.users nach Signup nicht gefunden (Trigger handle_new_user?).",
        profileErr?.message ?? "",
      );
      process.exit(1);
    }

    console.log("Bootstrap-Admin erstellt:");
    console.log("  E-Mail:   ", seedEmail);
    console.log("  Passwort: ", seedPassword);
    console.log("  Username: ", profile.username, "| Rolle:", profile.role);
  }

  const { data: row, error: invErr } = await supabase
    .from("invitation_tokens")
    .insert({ created_by: createdBy })
    .select("token")
    .single();

  if (invErr) {
    console.error("invitation_tokens einfügen fehlgeschlagen:", invErr.message);
    process.exit(1);
  }

  const base =
    process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, "") ??
    "http://localhost:3000";
  console.log("\nEinladungslink:");
  console.log(`${base}/register?token=${row.token}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
