import JSZip from "jszip";
import { saveAs } from "file-saver";
import { createClient } from "@/lib/supabase/client";
import type { ProjectExportPayload } from "@/lib/actions/export";
import { buildOfflineGalleryHtml } from "./offline-gallery-html";

function normalizeMemePath(path: string): string {
  return path.replace(/^\/+/, "").trim();
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

export async function runProjectZipExport(
  payload: ProjectExportPayload,
  onProgress: (pct: number) => void,
): Promise<{ error?: string }> {
  try {
    onProgress(0);
    const supabase = createClient();
    const zip = new JSZip();

    const imgFolder =
      payload.posts.length > 0 ? zip.folder("images") : null;
    if (payload.posts.length > 0 && !imgFolder) {
      return { error: "ZIP konnte den Ordner images nicht anlegen." };
    }

    const n = payload.posts.length;
    for (let i = 0; i < n; i++) {
      const post = payload.posts[i];
      const path = normalizeMemePath(post.meme_image_url);
      const { data: fileBlob, error: dlError } = await supabase.storage
        .from("memes")
        .download(path);

      if (dlError || !fileBlob) {
        return {
          error:
            dlError?.message ??
            `Meme konnte nicht geladen werden (Post ${post.id}).`,
        };
      }

      if (fileBlob.size < 32) {
        return { error: `Leere Bilddatei für Post ${post.id}` };
      }

      imgFolder!.file(`${post.id}.jpg`, fileBlob);
      const pct = 5 + Math.round((85 * (i + 1)) / n);
      onProgress(Math.min(pct, 90));
    }

    if (n === 0) {
      onProgress(90);
    }

    zip.file("data.json", JSON.stringify(payload, null, 2));
    zip.file(
      "index.html",
      buildOfflineGalleryHtml(payload.project.name, payload.posts),
    );

    onProgress(92);
    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const base = sanitizeExportBasename(payload.project.name);
    const dateStr = new Date().toISOString().slice(0, 10);
    saveAs(blob, `export_${base}_${dateStr}.zip`);
    onProgress(100);
    return {};
  } catch (err) {
    console.error("[runProjectZipExport]", err);
    return { error: "Export fehlgeschlagen." };
  }
}
