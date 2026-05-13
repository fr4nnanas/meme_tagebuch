/**
 * Kopiert bestehende Medien aus Supabase Storage nach Cloudflare R2 mit Sharp-Derivaten
 * und aktualisiert Object-Keys in `posts` / `users.avatar_url`.
 *
 * Ausführung aus frontend/:
 *   node --env-file=.env.local scripts/migrate-supabase-to-r2.mjs
 *   node --env-file=.env.local scripts/migrate-supabase-to-r2.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-supabase-to-r2.mjs --limit=50
 */

import {
  PutObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const ORIG = "originals";
const MEMS = "memes";
const AVAS = "avatars";

function normalizeR2Key(key) {
  const trimmed = String(key ?? "")
    .replace(/^\/+/, "")
    .trim();
  const q = trimmed.indexOf("?");
  const h = trimmed.indexOf("#");
  let end = trimmed.length;
  if (q >= 0) end = Math.min(end, q);
  if (h >= 0) end = Math.min(end, h);
  return trimmed.slice(0, end);
}

/** Entfernt einen logischen Prefix, falls gesetzt („originals/proj/…“ → „proj/…“). */
function stripLogicalPrefix(storeVal, logicalPrefixSlash) {
  const k = normalizeR2Key(storeVal);
  return k.startsWith(logicalPrefixSlash)
    ? k.slice(logicalPrefixSlash.length)
    : k;
}

function canonicalPostKey(storeVal, logicalPrefix) {
  const k = normalizeR2Key(storeVal);
  const p = `${logicalPrefix}/`;
  return k.startsWith(p) ? k : `${p}${k}`;
}

function thumbSuffix(fullKey) {
  const k = normalizeR2Key(fullKey);
  const dot = k.lastIndexOf(".");
  const base = dot <= 0 ? k : k.slice(0, dot);
  return `${base}_thumb.webp`;
}

function feedSuffix(fullKey) {
  const k = normalizeR2Key(fullKey);
  const dot = k.lastIndexOf(".");
  const base = dot <= 0 ? k : k.slice(0, dot);
  return `${base}_feed.webp`;
}

function uniq(paths) {
  return [...new Set(paths.filter(Boolean))];
}

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  let limit = Infinity;
  for (const a of process.argv) {
    if (a.startsWith("--limit=")) {
      const n = Number(a.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
  }
  return { dryRun, limit };
}

function requireEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const ak = process.env.R2_ACCESS_KEY_ID?.trim();
  const sk = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!url || !svc) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.",
    );
    process.exit(1);
  }
  if (!accountId || !bucket || !ak || !sk) {
    console.error(
      "R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY müssen gesetzt sein.",
    );
    process.exit(1);
  }
  return { url, svc, r2: { accountId, bucket, ak, sk } };
}

async function blobToBuffer(blob) {
  return Buffer.from(await blob.arrayBuffer());
}

function r2S3(cfg) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.ak,
      secretAccessKey: cfg.sk,
    },
    forcePathStyle: true,
  });
}

async function r2Exists(client, Bucket, Key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket, Key: normalizeR2Key(Key) }));
    return true;
  } catch {
    return false;
  }
}

async function r2Put(client, Bucket, Key, Body, ContentType, cacheControl) {
  await client.send(
    new PutObjectCommand({
      Bucket,
      Key: normalizeR2Key(Key),
      Body,
      ContentType,
      CacheControl: cacheControl,
    }),
  );
}

async function putOriginalVariants(client, Bucket, jpegBuffer, fullKey) {
  const base = normalizeR2Key(fullKey);
  await r2Put(
    client,
    Bucket,
    base,
    jpegBuffer,
    "image/jpeg",
    "public, max-age=31536000, immutable",
  );
  const thumbBuf = await sharp(jpegBuffer)
    .resize(400, 600, { fit: "cover", position: "attention" })
    .webp({ quality: 78 })
    .toBuffer();
  await r2Put(
    client,
    Bucket,
    thumbSuffix(base),
    thumbBuf,
    "image/webp",
    "public, max-age=31536000, immutable",
  );
}

async function putMemeVariants(client, Bucket, jpegBuffer, fullKey) {
  const base = normalizeR2Key(fullKey);
  await r2Put(
    client,
    Bucket,
    base,
    jpegBuffer,
    "image/jpeg",
    "public, max-age=31536000, immutable",
  );
  const thumbBuf = await sharp(jpegBuffer)
    .resize(400, 600, { fit: "cover", position: "attention" })
    .webp({ quality: 78 })
    .toBuffer();
  const feedBuf = await sharp(jpegBuffer)
    .resize(800, 1200, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toBuffer();
  await r2Put(
    client,
    Bucket,
    thumbSuffix(base),
    thumbBuf,
    "image/webp",
    "public, max-age=31536000, immutable",
  );
  await r2Put(
    client,
    Bucket,
    feedSuffix(base),
    feedBuf,
    "image/webp",
    "public, max-age=31536000, immutable",
  );
}

async function putAvatarVariants(client, Bucket, jpegBuffer, fullKey) {
  const storageKey = normalizeR2Key(fullKey);
  const mainBuf = await sharp(jpegBuffer)
    .resize(512, 512, { fit: "cover", position: "attention" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  const thumbBuf = await sharp(mainBuf)
    .resize(128, 128, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toBuffer();
  await r2Put(
    client,
    Bucket,
    storageKey,
    mainBuf,
    "image/jpeg",
    "public, max-age=86400",
  );
  await r2Put(
    client,
    Bucket,
    thumbSuffix(storageKey),
    thumbBuf,
    "image/webp",
    "public, max-age=86400",
  );
}

async function downloadFirst(supabase, bucketId, legacyPaths) {
  for (const p of uniq(legacyPaths)) {
    const { data, error } = await supabase.storage
      .from(bucketId)
      .download(normalizeR2Key(p));
    if (!error && data && data.size >= 16) return blobToBuffer(data);
  }
  return null;
}

/** Zieldatei in R2; `null` wenn kein Profilbild vorliegt oder URL nicht verwertbar ist. */
function avatarTargetKey(raw, _userId) {
  const t = (raw ?? "").trim();
  if (!t) return null;

  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const marker = "/object/public/avatars/";
      const i = u.pathname.indexOf(marker);
      if (i >= 0) {
        const rel = decodeURIComponent(u.pathname.slice(i + marker.length));
        const nk = normalizeR2Key(rel);
        return nk.startsWith(`${AVAS}/`) ? nk : normalizeR2Key(`${AVAS}/${nk}`);
      }
      const po = decodeURIComponent(u.pathname.replace(/^\/+/, "")).split("?")[0];
      if (po.startsWith(`${AVAS}/`)) return normalizeR2Key(po);
    } catch {
      /**/
    }
    return null;
  }

  const k = normalizeR2Key(t);
  return k.startsWith(`${AVAS}/`) ? k : normalizeR2Key(`${AVAS}/${k}`);
}

function avatarLegacyDownloadPaths(raw) {
  const t = (raw ?? "").trim();
  const out = [];
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const marker = "/object/public/avatars/";
      const i = u.pathname.indexOf(marker);
      if (i >= 0) {
        out.push(decodeURIComponent(u.pathname.slice(i + marker.length)));
        return uniq(out);
      }
      const po = decodeURIComponent(u.pathname.replace(/^\/+/, "")).split("?")[0];
      if (po.startsWith(`${AVAS}/`)) {
        out.push(stripLogicalPrefix(po, `${AVAS}/`));
        return uniq(out);
      }
    } catch {
      /**/
    }
    return uniq(out);
  }
  const k = normalizeR2Key(t);
  if (k.startsWith(`${AVAS}/`))
    out.push(stripLogicalPrefix(k, `${AVAS}/`));
  else out.push(k);
  return uniq(out);
}

async function main() {
  const { dryRun, limit } = parseArgs();
  const cfg = requireEnv();

  const supabase = createClient(cfg.url, cfg.svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const s3 = r2S3(cfg.r2);
  const Bucket = cfg.r2.bucket;

  console.log(
    `[migrate-supabase-to-r2] dryRun=${dryRun} limit=${limit === Infinity ? "∞" : limit}`,
  );

  let postProcessed = 0;

  const pageSize = 200;
  outer: for (let offset = 0; ; offset += pageSize) {
    const { data: rows, error } = await supabase
      .from("posts")
      .select("id, original_image_url, meme_image_url")
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("posts.fetch:", error.message);
      process.exit(1);
    }

    const batch = rows ?? [];
    if (!batch.length) break;

    for (const row of batch) {
      if (postProcessed >= limit) break outer;

      const origCanon = canonicalPostKey(row.original_image_url, ORIG);
      const memeCanon = row.meme_image_url
        ? canonicalPostKey(row.meme_image_url, MEMS)
        : null;

      const origLegacy = uniq([
        stripLogicalPrefix(row.original_image_url, `${ORIG}/`),
        normalizeR2Key(row.original_image_url ?? ""),
      ]);
      let origBuf =
        !(await r2Exists(s3, Bucket, origCanon)) ||
          !(await r2Exists(s3, Bucket, thumbSuffix(origCanon)))
          ? await downloadFirst(supabase, "originals", origLegacy)
          : null;

      if (
        !(await r2Exists(s3, Bucket, origCanon)) ||
        !(await r2Exists(s3, Bucket, thumbSuffix(origCanon)))
      ) {
        if (!origBuf) {
          console.warn(`[SKIP orig post ${row.id}] Kein Zugriff auf Supabase-Objekt`);
        } else if (!dryRun) {
          await putOriginalVariants(s3, Bucket, origBuf, origCanon);
          console.log(`[R2 originals] ${origCanon}`);
        } else console.log(`[dry-run] originals ${origCanon}`);
      }

      let memeBuf = null;
      if (memeCanon) {
        const complete =
          (await r2Exists(s3, Bucket, memeCanon)) &&
          (await r2Exists(s3, Bucket, thumbSuffix(memeCanon))) &&
          (await r2Exists(s3, Bucket, feedSuffix(memeCanon)));
        if (!complete) {
          const memeLegacy = uniq([
            stripLogicalPrefix(row.meme_image_url ?? "", `${MEMS}/`),
            normalizeR2Key(row.meme_image_url ?? ""),
          ]);
          memeBuf = await downloadFirst(supabase, "memes", memeLegacy);
          if (!memeBuf)
            console.warn(`[SKIP meme post ${row.id}] Kein Zugriff auf Supabase-Objekt`);
          else if (!dryRun) {
            await putMemeVariants(s3, Bucket, memeBuf, memeCanon);
            console.log(`[R2 memes] ${memeCanon}`);
          } else console.log(`[dry-run] meme ${memeCanon}`);
        }
      }

      if (!dryRun) {
        const patch = {};
        if (normalizeR2Key(row.original_image_url) !== normalizeR2Key(origCanon))
          patch.original_image_url = origCanon;
        if (
          memeCanon &&
          normalizeR2Key(row.meme_image_url ?? "") !==
            normalizeR2Key(memeCanon)
        )
          patch.meme_image_url = memeCanon;

        if (Object.keys(patch).length) {
          const { error: upErr } = await supabase
            .from("posts")
            .update(patch)
            .eq("id", row.id);
          if (upErr)
            console.error(`posts.update ${row.id}:`, upErr.message);
        }
      }

      postProcessed++;
    }

    if (batch.length < pageSize) break;
  }

  const { data: users, error: uErr } = await supabase.from("users").select("id, avatar_url");
  if (uErr) {
    console.error("users.fetch:", uErr.message);
  } else {
    for (const u of users ?? []) {
      const tgt = avatarTargetKey(u.avatar_url ?? "", u.id);
      if (!tgt) continue;

      const has =
        (await r2Exists(s3, Bucket, tgt)) &&
        (await r2Exists(s3, Bucket, thumbSuffix(tgt)));

      let avBuf = null;
      if (!has) {
        avBuf = await downloadFirst(
          supabase,
          "avatars",
          avatarLegacyDownloadPaths(u.avatar_url),
        );
        if (!avBuf) {
          console.warn(`[SKIP avatar user ${u.id}]`);
          continue;
        }
        if (!dryRun) {
          await putAvatarVariants(s3, Bucket, avBuf, tgt);
          console.log(`[R2 avatar] ${tgt}`);
        } else console.log(`[dry-run] avatar ${tgt}`);
      }

      if (!dryRun && normalizeR2Key(u.avatar_url ?? "") !== normalizeR2Key(tgt)) {
        await supabase
          .from("users")
          .update({ avatar_url: normalizeR2Key(tgt) })
          .eq("id", u.id);
      }
    }
  }

  console.log(`Fertig. Posts durchlaufen: ${postProcessed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
