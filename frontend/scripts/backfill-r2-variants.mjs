/**
 * Erzeugt fehlende `_thumb.webp` / `_feed.webp` auf R2 für bereits vorhandene Haupt-JPEGs.
 * Liest Post-/Avatar-Keys aus Supabase; lädt nur von R2 (kein Supabase-Storage).
 *
 * Ausführung aus frontend/:
 *   node --env-file=.env.local scripts/backfill-r2-variants.mjs
 *   node --env-file=.env.local scripts/backfill-r2-variants.mjs --dry-run
 *   node --env-file=.env.local scripts/backfill-r2-variants.mjs --limit=100
 */

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const MEMES = "memes";
const ORIGINALS = "originals";
const AVATARS = "avatars";

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

async function r2GetBuffer(client, Bucket, Key) {
  const res = await client.send(
    new GetObjectCommand({ Bucket, Key: normalizeR2Key(Key) }),
  );
  const body = res.Body;
  if (!body) throw new Error(`R2 GetObject: leerer Body (${Key})`);
  const chunks = [];
  for await (const chunk of body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function r2PutWebp(client, Bucket, Key, Body, cacheControl) {
  await client.send(
    new PutObjectCommand({
      Bucket,
      Key: normalizeR2Key(Key),
      Body,
      ContentType: "image/webp",
      CacheControl: cacheControl,
    }),
  );
}

async function ensureOriginalThumb(client, Bucket, fullKey, dryRun) {
  const base = normalizeR2Key(fullKey);
  const thumb = thumbSuffix(base);
  if ((await r2Exists(client, Bucket, thumb)) || !(await r2Exists(client, Bucket, base))) {
    return false;
  }
  if (dryRun) {
    console.log(`[dry-run] thumb ${thumb}`);
    return true;
  }
  const jpegBuffer = await r2GetBuffer(client, Bucket, base);
  const thumbBuf = await sharp(jpegBuffer)
    .resize(400, 600, { fit: "cover", position: "attention" })
    .webp({ quality: 78 })
    .toBuffer();
  await r2PutWebp(
    client,
    Bucket,
    thumb,
    thumbBuf,
    "public, max-age=31536000, immutable",
  );
  console.log(`[thumb] ${thumb}`);
  return true;
}

async function ensureMemeDerivatives(client, Bucket, fullKey, dryRun) {
  const base = normalizeR2Key(fullKey);
  const thumb = thumbSuffix(base);
  const feed = feedSuffix(base);
  const hasThumb = await r2Exists(client, Bucket, thumb);
  const hasFeed = await r2Exists(client, Bucket, feed);
  if (!(await r2Exists(client, Bucket, base))) return false;
  if (hasThumb && hasFeed) return false;

  if (dryRun) {
    if (!hasThumb) console.log(`[dry-run] thumb ${thumb}`);
    if (!hasFeed) console.log(`[dry-run] feed ${feed}`);
    return true;
  }

  const jpegBuffer = await r2GetBuffer(client, Bucket, base);
  let changed = false;

  if (!hasThumb) {
    const thumbBuf = await sharp(jpegBuffer)
      .resize(400, 600, { fit: "cover", position: "attention" })
      .webp({ quality: 78 })
      .toBuffer();
    await r2PutWebp(
      client,
      Bucket,
      thumb,
      thumbBuf,
      "public, max-age=31536000, immutable",
    );
    console.log(`[thumb] ${thumb}`);
    changed = true;
  }

  if (!hasFeed) {
    const feedBuf = await sharp(jpegBuffer)
      .resize(800, 1200, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
    await r2PutWebp(
      client,
      Bucket,
      feed,
      feedBuf,
      "public, max-age=31536000, immutable",
    );
    console.log(`[feed] ${feed}`);
    changed = true;
  }

  return changed;
}

async function ensureAvatarThumb(client, Bucket, fullKey, dryRun) {
  const base = normalizeR2Key(fullKey);
  const thumb = thumbSuffix(base);
  if ((await r2Exists(client, Bucket, thumb)) || !(await r2Exists(client, Bucket, base))) {
    return false;
  }
  if (dryRun) {
    console.log(`[dry-run] avatar thumb ${thumb}`);
    return true;
  }
  const jpegBuffer = await r2GetBuffer(client, Bucket, base);
  const thumbBuf = await sharp(jpegBuffer)
    .resize(128, 128, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toBuffer();
  await r2PutWebp(
    client,
    Bucket,
    thumb,
    thumbBuf,
    "public, max-age=86400",
  );
  console.log(`[avatar thumb] ${thumb}`);
  return true;
}

function canonicalPostKey(storeVal, logicalPrefix) {
  const k = normalizeR2Key(storeVal);
  const p = `${logicalPrefix}/`;
  return k.startsWith(p) ? k : `${p}${k}`;
}

function avatarTargetKey(raw, userId) {
  const t = (raw ?? "").trim();
  if (!t) return normalizeR2Key(`${AVATARS}/${userId}/avatar.jpg`);
  const k = normalizeR2Key(t);
  if (k.startsWith(`${AVATARS}/`)) return k;
  return normalizeR2Key(`${AVATARS}/${k}`);
}

async function main() {
  const { dryRun, limit } = parseArgs();
  const cfg = requireEnv();
  const supabase = createClient(cfg.url, cfg.svc);
  const s3 = r2S3(cfg.r2);
  const Bucket = cfg.r2.bucket;

  console.log(
    `[backfill-r2-variants] dryRun=${dryRun} limit=${limit === Infinity ? "∞" : limit}`,
  );

  let processed = 0;
  let updated = 0;
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
      if (processed >= limit) break outer;

      const origKey = canonicalPostKey(row.original_image_url, ORIGINALS);
      if (await ensureOriginalThumb(s3, Bucket, origKey, dryRun)) updated++;

      if (row.meme_image_url) {
        const memeKey = canonicalPostKey(row.meme_image_url, MEMES);
        if (await ensureMemeDerivatives(s3, Bucket, memeKey, dryRun)) updated++;
      }

      processed++;
    }

    if (batch.length < pageSize) break;
  }

  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("id, avatar_url");
  if (uErr) {
    console.error("users.fetch:", uErr.message);
  } else {
    for (const u of users ?? []) {
      const tgt = avatarTargetKey(u.avatar_url ?? "", u.id);
      if (!tgt) continue;
      if (await ensureAvatarThumb(s3, Bucket, tgt, dryRun)) updated++;
    }
  }

  console.log(
    `Fertig. Posts geprüft: ${processed}. Derivat-Aktionen: ${updated}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
