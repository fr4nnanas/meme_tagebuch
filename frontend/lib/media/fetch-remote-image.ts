import { getR2PublicBase, normalizeR2Key } from "@/lib/storage/r2-url";

export type FetchRemoteImageResult =
  | { ok: true; blob: Blob }
  | { ok: false; message: string };

function storageKeyFromPublicUrl(url: string): string | null {
  const base = getR2PublicBase();
  if (!base) return null;
  const normalizedBase = base.replace(/\/$/, "");
  if (!url.startsWith(`${normalizedBase}/`)) return null;
  const encodedPath = url.slice(normalizedBase.length + 1);
  try {
    return normalizeR2Key(
      encodedPath
        .split("/")
        .map((segment) => decodeURIComponent(segment))
        .join("/"),
    );
  } catch {
    return null;
  }
}

function proxyUrlForPublicImage(publicUrl: string): string | null {
  const key = storageKeyFromPublicUrl(publicUrl);
  if (key) {
    return `/api/media/blob?key=${encodeURIComponent(key)}`;
  }
  return `/api/media/blob?url=${encodeURIComponent(publicUrl)}`;
}

async function readProxyErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error?.trim()) return body.error;
  } catch {
    /* JSON optional */
  }
  return `Bild nicht geladen (HTTP ${res.status})`;
}

async function fetchViaProxy(publicUrl: string): Promise<FetchRemoteImageResult> {
  const proxyUrl = proxyUrlForPublicImage(publicUrl);
  if (!proxyUrl) {
    return { ok: false, message: "Bild-URL ist ungültig" };
  }

  try {
    const res = await fetch(proxyUrl, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, message: await readProxyErrorMessage(res) };
    }
    const blob = await res.blob();
    if (blob.size < 16) {
      return { ok: false, message: "Bilddatei ist leer oder fehlt" };
    }
    return { ok: true, blob };
  } catch {
    return {
      ok: false,
      message: "Bild konnte nicht geladen werden (Netzwerkfehler)",
    };
  }
}

/** Lädt ein öffentliches Meme-Bild; bei CORS-Problemen über same-origin Proxy. */
export async function fetchRemoteImageBlob(
  publicUrl: string,
): Promise<FetchRemoteImageResult> {
  if (!publicUrl?.trim()) {
    return { ok: false, message: "Keine Bild-URL vorhanden" };
  }

  try {
    const direct = await fetch(publicUrl, { mode: "cors", cache: "no-store" });
    if (direct.ok) {
      const blob = await direct.blob();
      if (blob.size >= 16) {
        return { ok: true, blob };
      }
    }
  } catch {
    /* Cross-Origin oder Netzwerk → Proxy */
  }

  return fetchViaProxy(publicUrl);
}
