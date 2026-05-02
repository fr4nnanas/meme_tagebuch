"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { updateProfile } from "@/lib/actions/profile";

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  initialUsername: string;
  initialBio: string;
}

export function EditProfileModal(props: EditProfileModalProps) {
  if (!props.open) return null;
  // Wenn der Dialog schließt, wird er unmounted; beim erneuten Öffnen liefert das
  // key-basierte Remount frische Initialwerte ohne synchrones setState im Effect.
  return <EditProfileModalContent {...props} />;
}

function EditProfileModalContent({
  onClose,
  initialUsername,
  initialBio,
}: EditProfileModalProps) {
  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(initialBio);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateProfile(formData);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Profil aktualisiert.");
      onClose();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-800 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2
            id="edit-profile-title"
            className="text-lg font-semibold text-zinc-100"
          >
            Profil bearbeiten
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
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
              maxLength={30}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 rounded-xl border border-zinc-800 bg-zinc-800 px-4 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="bio" className="text-sm font-medium text-zinc-300">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={3}
              maxLength={280}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Erzähle etwas über dich …"
              className="resize-none rounded-xl border border-zinc-800 bg-zinc-800 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
            <span className="text-right text-xs text-zinc-500">
              {bio.length}/280
            </span>
          </div>

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-12 flex-1 rounded-full border border-zinc-800 bg-zinc-800 font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-orange-500 font-semibold text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Speichern …
                </>
              ) : (
                "Speichern"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
