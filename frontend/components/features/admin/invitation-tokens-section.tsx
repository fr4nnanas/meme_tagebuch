"use client";

import { useTransition } from "react";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { TokenRow } from "@/app/(app)/admin/page";
import {
  deleteInvitationToken,
  generateInvitationToken,
} from "@/lib/actions/admin";

interface InvitationTokensSectionProps {
  tokens: TokenRow[];
}

function TokenRow({ token }: { token: TokenRow }) {
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const registrationUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/register?token=${token.token}`;

  function handleCopy() {
    navigator.clipboard
      .writeText(registrationUrl)
      .then(() => {
        setCopied(true);
        toast.success("Link kopiert!");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Kopieren fehlgeschlagen."));
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteInvitationToken(token.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Token gelöscht.");
      }
    });
  }

  const createdAt = new Date(token.created_at).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 space-y-2">
      {/* Token-Code */}
      <p className="font-mono text-xs text-zinc-400 break-all leading-relaxed">
        {token.token}
      </p>

      {/* Aktionen */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">Erstellt: {createdAt}</span>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Kopiert" : "Link kopieren"}
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
            aria-label="Token löschen"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

export function InvitationTokensSection({
  tokens,
}: InvitationTokensSectionProps) {
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateInvitationToken();
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Neuer Einladungslink generiert.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100">
          Einladungslinks ({tokens.length})
        </h2>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500 text-white text-sm font-medium hover:bg-orange-400 disabled:opacity-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {isPending ? "Generieren…" : "Generieren"}
        </button>
      </div>

      {/* Hinweis-Box */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3">
        <p className="text-xs text-zinc-400 leading-relaxed">
          Jeder Link kann mehrfach genutzt werden. Teile ihn nur mit
          vertrauenswürdigen Personen. Über{" "}
          <span className="text-zinc-300">„Link kopieren"</span> erhältst du
          den vollständigen Registrierungslink.
        </p>
      </div>

      {/* Token-Liste */}
      {tokens.length > 0 ? (
        <ul className="space-y-2">
          {tokens.map((token) => (
            <TokenRow key={token.id} token={token} />
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900 p-6 text-center">
          <p className="text-sm text-zinc-400">
            Noch keine Einladungslinks generiert.
          </p>
        </div>
      )}
    </div>
  );
}
