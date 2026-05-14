/**
 * Web Share API mit Zwischenablage- und Download-Fallbacks.
 */

import { downloadBlob } from "@/lib/media/download-blob";
import { fetchRemoteImageBlob } from "@/lib/media/fetch-remote-image";

export function isWebShareAvailable(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function buildProfileUrl(userId: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/profile/${userId}`;
}

export function buildProjectFeedUrl(projectId: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/feed?project=${encodeURIComponent(projectId)}`;
}

export type ShareOutcome =
  | "shared"
  | "downloaded"
  | "clipboard"
  | "cancelled"
  | "unavailable";

export type ShareMemeResult =
  | { outcome: "shared" | "downloaded" | "cancelled" }
  | { outcome: "unavailable"; message: string };

function imageExtension(blob: Blob): "png" | "jpeg" {
  return blob.type.includes("png") ? "png" : "jpeg";
}

function normalizeShareImageType(blob: Blob): string {
  if (blob.type.includes("png")) return "image/png";
  return "image/jpeg";
}

function buildMemeFilename(userId: string, blob: Blob): string {
  return `meme-${userId.slice(0, 8)}.${imageExtension(blob)}`;
}

async function tryShareFiles(data: ShareData): Promise<"shared" | "unsupported" | "cancelled"> {
  if (
    typeof navigator.canShare === "function" &&
    !navigator.canShare(data)
  ) {
    return "unsupported";
  }
  try {
    await navigator.share(data);
    return "shared";
  } catch (e) {
    if ((e as Error).name === "AbortError") return "cancelled";
    return "unsupported";
  }
}

/** Meme nur als Bilddatei teilen (ohne URL oder Profil-Link im System-Dialog). */
export async function shareMemeFromPost(options: {
  imageUrl: string | null;
  username: string;
  userId: string;
  caption: string | null;
}): Promise<ShareMemeResult> {
  const title = `Meme von ${options.username}`;

  if (!options.imageUrl) {
    return { outcome: "unavailable", message: "Kein Bild zum Teilen vorhanden" };
  }

  const fetched = await fetchRemoteImageBlob(options.imageUrl);
  if (!fetched.ok) {
    return { outcome: "unavailable", message: fetched.message };
  }

  const imageBlob = fetched.blob;
  const filename = buildMemeFilename(options.userId, imageBlob);
  const file = new File([imageBlob], filename, {
    type: normalizeShareImageType(imageBlob),
  });

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const withTitle = await tryShareFiles({ title, files: [file] });
    if (withTitle === "shared") return { outcome: "shared" };
    if (withTitle === "cancelled") return { outcome: "cancelled" };

    const filesOnly = await tryShareFiles({ files: [file] });
    if (filesOnly === "shared") return { outcome: "shared" };
    if (filesOnly === "cancelled") return { outcome: "cancelled" };
  }

  if (typeof document !== "undefined") {
    downloadBlob(imageBlob, filename);
    return { outcome: "downloaded" };
  }

  return {
    outcome: "unavailable",
    message: "Teilen wird auf diesem Gerät nicht unterstützt",
  };
}

/** Link zum Projekt-Feed (Mitglieder öffnen dasselbe Projekt per Query). */
export async function shareProjectAlbumLink(
  projectName: string,
  projectId: string,
): Promise<ShareOutcome> {
  const url = buildProjectFeedUrl(projectId);
  const title = `Meme-Tagebuch: ${projectName}`;
  const text = `Projekt „${projectName}“\n${url}`;

  if (isWebShareAvailable()) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }

  if (await copyToClipboard(url)) return "clipboard";
  return "unavailable";
}

/** ZIP-Datei über das System-Share-Sheet (mobil) oder Download als Fallback. */
export async function shareZipFile(options: {
  blob: Blob;
  filename: string;
  projectName: string;
}): Promise<"shared" | "shared-text" | "cancelled" | "download"> {
  const { blob, filename, projectName } = options;
  const file = new File([blob], filename, { type: "application/zip" });
  const title = `Export: ${projectName}`;
  const text = `Offline-Paket (ZIP) für „${projectName}“`;

  const withFiles: ShareData = { title, text, files: [file] };

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare(withFiles)
  ) {
    try {
      await navigator.share(withFiles);
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }

  if (isWebShareAvailable()) {
    try {
      await navigator.share({ title, text });
      return "shared-text";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }

  return "download";
}
