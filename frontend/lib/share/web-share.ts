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
  | "downloaded"
  | "clipboard"
  | "cancelled"
  | "unavailable";

function downloadBlobAsFile(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Meme nur als Bilddatei teilen (ohne URL oder Profil-Link im System-Dialog). */
export async function shareMemeFromPost(options: {
  imageUrl: string | null;
  username: string;
  userId: string;
  caption: string | null;
}): Promise<ShareOutcome> {
  const title = `Meme von ${options.username}`;
  let imageBlob: Blob | null = null;

  if (options.imageUrl && typeof navigator !== "undefined") {
    try {
      const res = await fetch(options.imageUrl);
      if (res.ok) {
        imageBlob = await res.blob();
        const ext = imageBlob.type.includes("png") ? "png" : "jpeg";
        const file = new File(
          [imageBlob],
          `meme-${options.userId.slice(0, 8)}.${ext}`,
          { type: imageBlob.type || "image/jpeg" },
        );

        const tryShareFiles = async (data: ShareData): Promise<boolean> => {
          if (
            typeof navigator.canShare === "function" &&
            !navigator.canShare(data)
          ) {
            return false;
          }
          try {
            await navigator.share(data);
            return true;
          } catch (e) {
            if ((e as Error).name === "AbortError") throw e;
            return false;
          }
        };

        try {
          if (await tryShareFiles({ title, files: [file] })) return "shared";
        } catch (e) {
          if ((e as Error).name === "AbortError") return "cancelled";
        }

        try {
          if (await tryShareFiles({ files: [file] })) return "shared";
        } catch (e) {
          if ((e as Error).name === "AbortError") return "cancelled";
        }
      }
    } catch {
      /* Fetch fehlgeschlagen — unten ggf. unavailable */
    }
  }

  if (imageBlob && typeof document !== "undefined") {
    const ext = imageBlob.type.includes("png") ? "png" : "jpeg";
    downloadBlobAsFile(imageBlob, `meme-${options.userId.slice(0, 8)}.${ext}`);
    return "downloaded";
  }

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
