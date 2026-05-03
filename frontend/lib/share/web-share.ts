/**
 * Web Share API mit Zwischenablage- und Download-Fallbacks.
 */

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
  | "clipboard"
  | "cancelled"
  | "unavailable";

/** Meme als Bilddatei und/oder mit Link zum Profil teilen. */
export async function shareMemeFromPost(options: {
  imageUrl: string | null;
  username: string;
  userId: string;
  caption: string | null;
}): Promise<ShareOutcome> {
  const title = `Meme von ${options.username}`;
  const profileUrl = buildProfileUrl(options.userId);
  const textParts = [
    options.caption?.trim() || undefined,
    profileUrl ? `Profil: ${profileUrl}` : undefined,
  ].filter(Boolean);
  const text = textParts.join("\n\n");

  if (options.imageUrl && typeof navigator !== "undefined") {
    try {
      const res = await fetch(options.imageUrl);
      if (res.ok) {
        const blob = await res.blob();
        const ext = blob.type.includes("png") ? "png" : "jpeg";
        const file = new File([blob], `meme-${options.userId.slice(0, 8)}.${ext}`, {
          type: blob.type || "image/jpeg",
        });
        const withFiles: ShareData = { title, text, url: profileUrl, files: [file] };
        if (
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
      }
    } catch {
      /* ohne Bild weiter */
    }
  }

  if (isWebShareAvailable()) {
    try {
      await navigator.share({ title, text, url: profileUrl });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }

  if (await copyToClipboard(profileUrl)) return "clipboard";
  return "unavailable";
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
