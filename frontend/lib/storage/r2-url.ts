/**
 * Pfad-/URL-Helfer für R2 (ohne AWS-SDK → sicher für Client Components).
 */

/** Entspricht ehemals Supabase-Bucket „originals“. */
export const R2_ORIGINAL_PREFIX = "originals" as const;
/** Entspricht ehemals Supabase-Bucket „memes“. */
export const R2_MEMES_PREFIX = "memes" as const;
/** Entspricht ehemals Supabase-Bucket „avatars“. */
export const R2_AVATARS_PREFIX = "avatars" as const;

/** Normalisiert ohne führende Slashes für R2-Object-Keys (sucht keine Query-/Fragment-Suffixe). */
export function normalizeR2Key(key: string): string {
  const trimmed = key.replace(/^\/+/, "").trim();
  const q = trimmed.indexOf("?");
  const h = trimmed.indexOf("#");
  let end = trimmed.length;
  if (q >= 0) end = Math.min(end, q);
  if (h >= 0) end = Math.min(end, h);
  return trimmed.slice(0, end);
}

export function originalObjectKey(
  projectId: string,
  userId: string,
  postId: string,
): string {
  return normalizeR2Key(
    `${R2_ORIGINAL_PREFIX}/${projectId}/${userId}/${postId}.jpg`,
  );
}

export function originalReference2ObjectKey(
  projectId: string,
  userId: string,
  postId: string,
): string {
  return normalizeR2Key(
    `${R2_ORIGINAL_PREFIX}/${projectId}/${userId}/${postId}_ref2.jpg`,
  );
}

export function memeAiVariantObjectKey(
  projectId: string,
  userId: string,
  postId: string,
  variant: 1 | 2,
): string {
  return normalizeR2Key(
    `${R2_MEMES_PREFIX}/${projectId}/${userId}/${postId}_v${variant}.jpg`,
  );
}

/** Canvas-/finaler Meme-JPEG unter memes/-Präfix. */
export function memePublishedObjectKey(
  projectId: string,
  userId: string,
  postId: string,
): string {
  return normalizeR2Key(
    `${R2_MEMES_PREFIX}/${projectId}/${userId}/${postId}.jpg`,
  );
}

export function avatarObjectKey(userId: string): string {
  return normalizeR2Key(`${R2_AVATARS_PREFIX}/${userId}/avatar.jpg`);
}

function thumbSuffixKey(fullKey: string): string {
  const k = normalizeR2Key(fullKey);
  const dot = k.lastIndexOf(".");
  if (dot <= 0) return `${k}_thumb.webp`;
  const base = k.slice(0, dot);
  return `${base}_thumb.webp`;
}

function feedSuffixKey(fullKey: string): string {
  const k = normalizeR2Key(fullKey);
  const dot = k.lastIndexOf(".");
  if (dot <= 0) return `${k}_feed.webp`;
  const base = k.slice(0, dot);
  return `${base}_feed.webp`;
}

/**
 * Löschliste: Original + Thumb; unter „memes/“ zusätzlich Feed-WebP.
 */
export function expandR2DeleteKeys(key: string): string[] {
  const k = normalizeR2Key(key);
  const out = new Set<string>([k, thumbSuffixKey(k)]);
  if (k.startsWith(`${R2_MEMES_PREFIX}/`)) {
    out.add(feedSuffixKey(k));
  }
  return [...out];
}

export function getR2PublicBase(): string {
  const b = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ?? "";
  return b.replace(/\/$/, "").trim();
}

export function encodeR2ObjectPathForPublicUrl(relKey: string): string {
  return normalizeR2Key(relKey)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export function r2Url(
  storageKeyOrPath: string,
  variant: "thumb" | "feed" | "full" = "full",
): string {
  const base = getR2PublicBase();
  if (!base) {
    throw new Error("NEXT_PUBLIC_R2_PUBLIC_BASE ist nicht gesetzt");
  }
  const key = normalizeR2Key(storageKeyOrPath);
  const resolved =
    variant === "full"
      ? key
      : variant === "thumb"
        ? thumbSuffixKey(key)
        : feedSuffixKey(key);
  return `${base}/${encodeR2ObjectPathForPublicUrl(resolved)}`;
}

export function safeR2Url(
  storageKeyOrPath: string | null | undefined,
  variant: "thumb" | "feed" | "full" = "full",
): string | null {
  if (!storageKeyOrPath?.trim()) return null;
  try {
    return r2Url(normalizeR2Key(storageKeyOrPath), variant);
  } catch {
    return null;
  }
}

/** True solange alte Supabase-Public-URLs in der DB stehen (Migration). */
export function isLegacySupabaseStorageUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return value.includes("/object/public/");
}

/** Extrahiert den Object-Key aus einer Supabase-Public-URL oder gibt normalisierten Pfad zurück. */
export function storageKeyFromAvatarField(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const u = new URL(trimmed);
      const marker = "/object/public/avatars/";
      const i = u.pathname.indexOf(marker);
      if (i !== -1) {
        const rel = normalizeR2Key(
          decodeURIComponent(u.pathname.slice(i + marker.length)),
        );
        return rel.startsWith(`${R2_AVATARS_PREFIX}/`)
          ? rel
          : normalizeR2Key(`${R2_AVATARS_PREFIX}/${rel}`);
      }
      /** Migrierter Avatar als vollständiger R2-Host-URL. */
      const pathOnly = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
      if (pathOnly.startsWith(`${R2_AVATARS_PREFIX}/`)) {
        const q = pathOnly.indexOf("?");
        return q === -1 ? pathOnly : pathOnly.slice(0, q);
      }
      return null;
    }
  } catch {
    return normalizeR2Key(trimmed);
  }
  return normalizeR2Key(trimmed);
}

/** Relativer Avatar-Pfad oder Public-URL → konsistenter Key `avatars/{user}/…`. */
export function normalizeAvatarStorageKey(input: string | null | undefined): string | null {
  const k = storageKeyFromAvatarField(input);
  if (!k) return null;
  if (k.startsWith(`${R2_AVATARS_PREFIX}/`)) return normalizeR2Key(k);
  return normalizeR2Key(`${R2_AVATARS_PREFIX}/${k}`);
}

/** Anzeige-URL für Avatare: Supabase bleibt während Migration; sonst öffentlicher R2-Key. */
export function resolveAvatarPublicUrl(
  raw: string | null | undefined,
  variant: "thumb" | "full",
): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  if (isLegacySupabaseStorageUrl(t)) {
    return t;
  }
  const key = normalizeAvatarStorageKey(t);
  return key ? safeR2Url(key, variant) : null;
}

/** Liste aller Derivat-Keys für dasselbe logische Hauptobjekt beim Verschieben (kopieren/löschen). */
export function expandR2CopyKeys(primaryKey: string): string[] {
  return expandR2DeleteKeys(primaryKey);
}
