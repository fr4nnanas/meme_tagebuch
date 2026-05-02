"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { UserAvatarLightbox } from "@/components/shared/user-avatar-lightbox";
import { updateAvatarUrl } from "@/lib/actions/profile";

interface AvatarUploaderProps {
  userId: string;
  initialAvatarUrl: string | null;
  username: string;
  isOwner: boolean;
}

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export function AvatarUploader({
  userId,
  initialAvatarUrl,
  username,
  isOwner,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);

  const busy = isUploading || isPending;

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("Datei ist zu groß (max. 4 MB).");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Nur Bilddateien sind erlaubt.");
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      // Pfadschema: /{user_id}/avatar.{ext} – Konvention aus .cursorrules
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: "0",
        });

      if (uploadError) {
        toast.error("Upload fehlgeschlagen: " + uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      // Cache-Buster, damit der neu hochgeladene Avatar sofort sichtbar wird
      const publicUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

      startTransition(async () => {
        const result = await updateAvatarUrl(publicUrl);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        setAvatarUrl(publicUrl);
        toast.success("Avatar aktualisiert.");
      });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="relative inline-flex">
      <UserAvatarLightbox
        avatarUrl={avatarUrl}
        username={username}
        sizeClassName="h-24 w-24"
        className="border-2 border-zinc-800"
        placeholderIconClassName="h-10 w-10"
      />

      {isOwner && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-label="Avatar ändern"
            className="absolute bottom-0 right-0 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30 ring-2 ring-zinc-900 transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </>
      )}
    </div>
  );
}
