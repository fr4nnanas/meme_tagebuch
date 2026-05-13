import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { ProjectExportPayload } from "@/lib/actions/export";
import { buildOfflineGalleryHtml } from "./offline-gallery-html";
import {
  normalizeAvatarStorageKey,
  normalizeR2Key,
  R2_AVATARS_PREFIX,
  R2_MEMES_PREFIX,
  R2_ORIGINAL_PREFIX,
  safeR2Url,
} from "@/lib/storage/r2-url";

async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

function canonicalMemeStorageKey(postUrl: string): string {
  const k = normalizeR2Key(postUrl);
  return k.startsWith(`${R2_MEMES_PREFIX}/`) ? k : `${R2_MEMES_PREFIX}/${k}`;
}

function canonicalOriginalStorageKey(postUrl: string): string {
  const k = normalizeR2Key(postUrl);
  return k.startsWith(`${R2_ORIGINAL_PREFIX}/`)
    ? k
    : `${R2_ORIGINAL_PREFIX}/${k}`;
}

function extFromStoragePath(path: string): string {
  const base = path.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "jpg";
  return base.slice(dot + 1).toLowerCase() || "jpg";
}

export function sanitizeExportBasename(name: string): string {
  const t = name
    .normalize("NFKC")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return t.length > 0 ? t : "projekt";
}

export type ProjectZipBuildResult =
  | { blob: Blob; filename: string }
  | { error: string };

export async function buildProjectZipBlob(
  payload: ProjectExportPayload,
  onProgress: (pct: number) => void,
): Promise<ProjectZipBuildResult> {
  try {
    onProgress(0);
    const zip = new JSZip();

    const imgFolder =
      payload.posts.length > 0 ? zip.folder("images") : null;
    if (payload.posts.length > 0 && !imgFolder) {
      return { error: "ZIP konnte den Ordner images nicht anlegen." };
    }

    /** Relativer Pfad in der entpackten ZIP → für index.html (./images/avatars/…). */
    const avatarRelByUserId = new Map<string, string>();

    if (imgFolder && payload.posts.length > 0) {
      const avatarFolder = imgFolder.folder("avatars");
      if (!avatarFolder) {
        return {
          error: "ZIP konnte den Ordner images/avatars nicht anlegen.",
        };
      }

      const latestAvatarUrl = new Map<string, string | null>();
      for (const post of payload.posts) {
        if (post.user.id) latestAvatarUrl.set(post.user.id, post.user.avatar_url);
        for (const c of post.comments) {
          if (c.user.id) latestAvatarUrl.set(c.user.id, c.user.avatar_url);
        }
      }

      for (const [uid, avatarField] of latestAvatarUrl) {
        const avatarKey = normalizeAvatarStorageKey(avatarField);
        if (!avatarKey?.startsWith(`${R2_AVATARS_PREFIX}/`) || !uid) continue;

        const publicUrl = safeR2Url(avatarKey, "full");
        if (!publicUrl) continue;

        const avBlob = await fetchImageBlob(publicUrl);
        if (!avBlob || avBlob.size < 16) continue;

        const ext = extFromStoragePath(avatarKey);
        const rel = `./images/avatars/${uid}.${ext}`;
        avatarFolder.file(`${uid}.${ext}`, avBlob);
        avatarRelByUserId.set(uid, rel);
      }
    }

    const n = payload.posts.length;
    for (let i = 0; i < n; i++) {
      const post = payload.posts[i];
      const memeKey = canonicalMemeStorageKey(post.meme_image_url);
      const memeUrl = safeR2Url(memeKey, "full");
      if (!memeUrl) {
        return { error: `Keine gültige R2-Konfiguration (Post ${post.id}).` };
      }

      const fileBlob = await fetchImageBlob(memeUrl);
      if (!fileBlob) {
        return {
          error: `Meme konnte nicht geladen werden (Post ${post.id}).`,
        };
      }

      if (fileBlob.size < 32) {
        return { error: `Leere Bilddatei für Post ${post.id}` };
      }

      imgFolder!.file(`${post.id}.jpg`, fileBlob);

      const origPathNorm = normalizeR2Key(post.original_image_url);
      if (origPathNorm) {
        const ok = canonicalOriginalStorageKey(origPathNorm);
        const origUrl = safeR2Url(ok, "full");
        if (origUrl) {
          const origBlob = await fetchImageBlob(origUrl);
          if (origBlob && origBlob.size >= 32) {
            imgFolder!.file(`${post.id}_original.jpg`, origBlob);
          }
        }
      }

      const pct = 5 + Math.round((85 * (i + 1)) / n);
      onProgress(Math.min(pct, 90));
    }

    if (n === 0) {
      onProgress(90);
    }

    zip.file("data.json", JSON.stringify(payload, null, 2));
    zip.file(
      "index.html",
      buildOfflineGalleryHtml(
        payload.project.name,
        payload.posts,
        avatarRelByUserId,
      ),
    );

    onProgress(92);
    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const base = sanitizeExportBasename(payload.project.name);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `export_${base}_${dateStr}.zip`;
    onProgress(100);
    return { blob, filename };
  } catch (err) {
    console.error("[buildProjectZipBlob]", err);
    return { error: "Export fehlgeschlagen." };
  }
}

export async function runProjectZipExport(
  payload: ProjectExportPayload,
  onProgress: (pct: number) => void,
): Promise<{ error?: string }> {
  const result = await buildProjectZipBlob(payload, onProgress);
  if ("error" in result) {
    return { error: result.error };
  }
  saveAs(result.blob, result.filename);
  return {};
}
