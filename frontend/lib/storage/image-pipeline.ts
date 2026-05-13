import sharp from "sharp";
import { avatarObjectKey, normalizeR2Key } from "@/lib/storage/r2-url";
import { r2Put } from "@/lib/storage/r2";

/**
 * Hauptspeicher + Thumb (400×600) und Feed-WebP für Memes (JPEG-Original).
 */
export async function uploadMemeJpegWithWebpVariants(
  fullMemeStorageKey: string,
  jpegBuffer: Buffer,
): Promise<void> {
  const baseKey = normalizeR2Key(fullMemeStorageKey);
  await r2Put(baseKey, jpegBuffer, "image/jpeg", { immutable: true });

  const thumbBuf = await sharp(jpegBuffer)
    .resize(400, 600, { fit: "cover", position: "attention" })
    .webp({ quality: 78 })
    .toBuffer();

  const feedBuf = await sharp(jpegBuffer)
    .resize(800, 1200, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toBuffer();

  const dot = baseKey.lastIndexOf(".");
  const baseLessExt = dot <= 0 ? baseKey : baseKey.slice(0, dot);

  await r2Put(`${baseLessExt}_thumb.webp`, thumbBuf, "image/webp", {
    immutable: true,
  });
  await r2Put(`${baseLessExt}_feed.webp`, feedBuf, "image/webp", {
    immutable: true,
  });
}

/**
 * Original-JPEG plus nur Thumb-WebP (kein Feed wie bei PLAN).
 */
export async function uploadOriginalJpegWithThumb(
  fullOriginalStorageKey: string,
  jpegBuffer: Buffer,
): Promise<void> {
  const baseKey = normalizeR2Key(fullOriginalStorageKey);
  await r2Put(baseKey, jpegBuffer, "image/jpeg", { immutable: true });

  const thumbBuf = await sharp(jpegBuffer)
    .resize(400, 600, { fit: "cover", position: "attention" })
    .webp({ quality: 78 })
    .toBuffer();

  const dot = baseKey.lastIndexOf(".");
  const baseLessExt = dot <= 0 ? baseKey : baseKey.slice(0, dot);
  await r2Put(`${baseLessExt}_thumb.webp`, thumbBuf, "image/webp", {
    immutable: true,
  });
}

/** 512-JPEG Hauptdatei und 128-WebP Thumb unter avatars/<id>/. */
export async function uploadAvatarFromJpegBuffer(
  userId: string,
  jpegBuffer: Buffer,
): Promise<{ storageKey: string }> {
  const storageKey = avatarObjectKey(userId);

  const mainBuf = await sharp(jpegBuffer)
    .resize(512, 512, { fit: "cover", position: "attention" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const thumbBuf = await sharp(mainBuf)
    .resize(128, 128, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toBuffer();

  await r2Put(storageKey, mainBuf, "image/jpeg", {
    immutable: false,
    isAvatar: true,
  });

  const dot = storageKey.lastIndexOf(".");
  const baseLessExt = dot <= 0 ? storageKey : storageKey.slice(0, dot);
  await r2Put(`${baseLessExt}_thumb.webp`, thumbBuf, "image/webp", {
    immutable: false,
    isAvatar: true,
  });

  return { storageKey };
}
