"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Sparkles, X } from "lucide-react";

const DISMISS_EVENT = "meme:interim-welcome-dismiss";

function storageKey(userId: string): string {
  return `meme_interim_welcome_dismissed:${userId}`;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DISMISS_EVENT, onChange);
  };
}

function getDismissedSnapshot(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(storageKey(userId)) === "1";
}

interface InterimWelcomeBannerProps {
  userId: string;
  username: string;
}

export function InterimWelcomeBanner({
  userId,
  username,
}: InterimWelcomeBannerProps) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => getDismissedSnapshot(userId),
    () => false,
  );

  const dismiss = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey(userId), "1");
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }, [userId]);

  if (dismissed) {
    return null;
  }

  const greeting = username.trim() ? `Hallo ${username}!` : "Willkommen!";

  return (
    <div
      role="status"
      className="mx-4 mt-4 rounded-xl border border-orange-500/35 bg-gradient-to-b from-orange-950/55 to-zinc-900/90 px-4 py-4 shadow-lg shadow-black/25"
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-300"
          aria-hidden
        >
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-zinc-50">{greeting}</p>
          <p className="mt-0.5 text-xs text-orange-100/85">
            Kurz erklärt, was in dieser Übergangsphase wichtig ist
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-200"
          aria-label="Hinweis schließen"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-200/95">
        <p>
          Du nutzt gerade eine Übergangsversion der App. Für deinen Alltag ändert
          sich nichts: Memes posten, kommentieren und mit der Gruppe bleiben –
          wie gewohnt.
        </p>
        <p>
          Alles, was du hier anlegst, bleibt deins und wird später automatisch
          wieder mit deinem gewohnten Konto verbunden. Du musst nichts umziehen.
        </p>
        <p className="text-zinc-300/90">
          Wenn du wieder im gewohnten Tagebuch bist, loggst du dich mit dem
          Benutzernamen und Passwort ein, das du schon kennst.
        </p>
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="mt-4 flex w-full items-center justify-center rounded-full bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-400"
      >
        Alles klar, los geht&apos;s
      </button>
    </div>
  );
}
