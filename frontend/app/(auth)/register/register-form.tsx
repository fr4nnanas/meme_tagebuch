"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { register } from "@/lib/actions/auth";

interface RegisterFormProps {
  token: string;
}

export function RegisterForm({ token }: RegisterFormProps) {
  const [isPending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await register(formData);
      if (result && "error" in result) {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <div className="flex flex-col gap-2">
        <label
          htmlFor="username"
          className="text-sm font-medium text-zinc-300"
        >
          Benutzername
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          minLength={3}
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="h-12 rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          placeholder="dein_benutzername"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="password"
          className="text-sm font-medium text-zinc-300"
        >
          Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          placeholder="Mindestens 6 Zeichen"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-orange-500 font-semibold text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Konto erstellen …
          </>
        ) : (
          "Konto erstellen"
        )}
      </button>
    </form>
  );
}
