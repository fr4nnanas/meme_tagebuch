"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { User, X } from "lucide-react";

export interface UserAvatarLightboxProps {
  avatarUrl: string | null;
  username: string;
  /** z. B. `h-9 w-9` oder `h-24 w-24` */
  sizeClassName?: string;
  /** Zusatzklassen für den runden Rahmen (z. B. Border auf der Profilseite) */
  className?: string;
  /** Größe des User-Icons bei fehlendem Bild */
  placeholderIconClassName?: string;
}

export function UserAvatarLightbox({
  avatarUrl,
  username,
  sizeClassName = "h-9 w-9",
  className = "",
  placeholderIconClassName = "h-5 w-5",
}: UserAvatarLightboxProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const stopLinkNavigation = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  if (!avatarUrl) {
    return (
      <div
        className={`${sizeClassName} flex-shrink-0 overflow-hidden rounded-full bg-zinc-800 ${className}`}
      >
        <div className="flex h-full w-full items-center justify-center text-zinc-600">
          <User className={`${placeholderIconClassName} shrink-0`} />
        </div>
      </div>
    );
  }

  const overlay =
    mounted &&
    open &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
        role="dialog"
        aria-modal="true"
        aria-label={`Profilbild ${username}`}
        onClick={() => setOpen(false)}
      >
        <button
          type="button"
          aria-label="Schließen"
          className="absolute right-3 top-[max(2rem,calc(env(safe-area-inset-top,0px)+1.25rem))] z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-zinc-800/95 text-white shadow-lg shadow-black/40 ring-2 ring-orange-500/35 backdrop-blur-sm transition-colors hover:border-orange-400/50 hover:bg-orange-600 hover:ring-orange-400/60 active:scale-[0.97]"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <X className="h-7 w-7" strokeWidth={2.25} aria-hidden />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={`Profilbild von ${username}`}
          className="max-h-[min(90vh,520px)] max-w-[min(90vw,520px)] rounded-full object-cover shadow-2xl"
          onClick={stopLinkNavigation}
        />
      </div>,
      document.body,
    );

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          stopLinkNavigation(e);
          setOpen(true);
        }}
        aria-label={`Profilbild von ${username} vergrößern`}
        className={`${sizeClassName} flex-shrink-0 overflow-hidden rounded-full bg-zinc-800 outline-none ring-orange-500/40 transition hover:ring-2 hover:ring-orange-500/40 focus-visible:ring-2 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      </button>
      {overlay}
    </>
  );
}
