import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getR2PublicBase, normalizeR2Key } from "@/lib/storage/r2-url";
import { r2Get } from "@/lib/storage/r2";

function contentTypeForKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function storageKeyFromUrlParam(urlParam: string): string | null {
  const base = getR2PublicBase().replace(/\/$/, "");
  if (!base) return null;

  let parsed: URL;
  try {
    parsed = new URL(urlParam);
  } catch {
    return null;
  }

  const baseUrl = new URL(base);
  if (parsed.origin !== baseUrl.origin) return null;

  const basePath = baseUrl.pathname.replace(/\/$/, "");
  const objectPath = parsed.pathname.replace(/\/$/, "");
  if (!objectPath.startsWith(`${basePath}/`)) return null;

  const encodedPath = objectPath.slice(basePath.length + 1);
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const keyParam = request.nextUrl.searchParams.get("key");
    const urlParam = request.nextUrl.searchParams.get("url");

    let storageKey: string | null = null;
    if (keyParam?.trim()) {
      storageKey = normalizeR2Key(keyParam);
    } else if (urlParam?.trim()) {
      storageKey = storageKeyFromUrlParam(urlParam.trim());
    }

    if (!storageKey) {
      return NextResponse.json(
        { error: "Bild-URL oder Speicherpfad fehlt" },
        { status: 400 },
      );
    }

    const buffer = await r2Get(storageKey);
    if (buffer.length < 16) {
      return NextResponse.json({ error: "Bilddatei fehlt" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeForKey(storageKey),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[media/blob]", err);
    const message =
      err instanceof Error ? err.message : "Bild konnte nicht geladen werden";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
