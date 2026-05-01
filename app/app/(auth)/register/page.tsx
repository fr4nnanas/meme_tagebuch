import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { RegisterForm } from "./register-form";

interface RegisterPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { token } = await searchParams;

  // Token serverseitig validieren, bevor das Formular angezeigt wird.
  // Nutzt Service Role, da invitation_tokens per RLS nur für Admins lesbar ist.
  let tokenValid = false;
  if (token) {
    const adminClient = createServiceRoleClient();
    const { data } = await adminClient
      .from("invitation_tokens")
      .select("id")
      .eq("token", token)
      .maybeSingle();
    tokenValid = Boolean(data);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-zinc-100">Registrieren</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Lege ein Konto nur mit Benutzername und Passwort an.
          </p>
        </div>

        {!tokenValid ? (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="font-medium">Einladung ungültig</p>
                <p className="mt-1 text-red-300/80">
                  {token
                    ? "Der Einladungstoken existiert nicht oder ist nicht mehr gültig."
                    : "Die Registrierung ist nur über einen Einladungslink möglich."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <RegisterForm token={token!} />
        )}

        <p className="mt-6 text-center text-sm text-zinc-400">
          Bereits ein Konto?{" "}
          <Link
            href="/login"
            className="font-medium text-orange-400 hover:text-orange-300"
          >
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
