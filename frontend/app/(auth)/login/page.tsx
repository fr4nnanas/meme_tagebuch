import Link from "next/link";
import { AppLogo } from "@/components/shared/app-logo";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <AppLogo className="mx-auto mb-6 rounded-2xl shadow-lg shadow-black/40" />
          <h1 className="text-3xl font-bold text-zinc-100">Anmelden</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Melde dich mit Benutzername und Passwort an.
          </p>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-sm text-zinc-400">
          Du hast einen Einladungslink?{" "}
          <Link
            href="/register"
            className="font-medium text-orange-400 hover:text-orange-300"
          >
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}
