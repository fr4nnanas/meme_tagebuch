"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { UserAvatarLightbox } from "@/components/shared/user-avatar-lightbox";
import { updateAvatarUrl } from "@/lib/actions/profile";
import { ImageCropper } from "@/components/features/upload/image-cropper";

interface AvatarUploaderProps {
  userId: string;
  initialAvatarUrl: string | null;
  username: string;
  isOwner: boolean;
}

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
/** Quadratischer Avatar, ausreichend für Darstellung und Retina */
const AVATAR_CROP_SIZE = 512;

export function AvatarUploader({
  userId,
  initialAvatarUrl,
  username,
  isOwner,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cropObjectUrlRef = useRef<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);

  const busy = isUploading || isPending;

  useEffect(() => {
    return () => {
      if (cropObjectUrlRef.current) {
        URL.revokeObjectURL(cropObjectUrlRef.current);
        cropObjectUrlRef.current = null;
      }
    };
  }, []);

  async function uploadAvatarFile(file: File) {
    setIsUploading(true);
    try {
      const supabase = createClient();
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

  function handlePickFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("Datei ist zu groß (max. 4 MB).");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Nur Bilddateien sind erlaubt.");
      return;
    }
    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    cropObjectUrlRef.current = url;
    setCropSrc(url);
    if (inputRef.current) inputRef.current.value = "";
  }

  function closeCropper() {
    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current);
      cropObjectUrlRef.current = null;
    }
    setCropSrc(null);
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
            disabled={busy || !!cropSrc}
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
              if (file) handlePickFile(file);
            }}
          />
        </>
      )}

      {cropSrc && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-labelledby="avatar-crop-title"
            className="flex max-h-[min(92dvh,880px)] w-full max-w-md flex-col gap-3 overflow-hidden rounded-t-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl sm:rounded-2xl"
          >
            <h2
              id="avatar-crop-title"
              className="text-lg font-semibold text-zinc-100"
            >
              Profilbild zuschneiden
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ImageCropper
                imageSrc={cropSrc}
                aspectRatio={1}
                outputWidth={AVATAR_CROP_SIZE}
                outputHeight={AVATAR_CROP_SIZE}
                onCancel={closeCropper}
                onCropComplete={(blob) => {
                  closeCropper();
                  const file = new File([blob], "avatar.jpg", {
                    type: "image/jpeg",
                  });
                  void uploadAvatarFile(file);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
