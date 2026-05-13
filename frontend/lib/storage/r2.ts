import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  expandR2DeleteKeys,
  normalizeR2Key,
} from "@/lib/storage/r2-url";

export * from "@/lib/storage/r2-url";

export function requireR2Config(): {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
} {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID oder R2_SECRET_ACCESS_KEY fehlt",
    );
  }
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

let cachedClient: S3Client | null = null;

export function r2Client(): S3Client {
  if (cachedClient) return cachedClient;
  const { accountId, accessKeyId, secretAccessKey } = requireR2Config();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return cachedClient;
}

async function resolvedBucket(): Promise<string> {
  return requireR2Config().bucket;
}

export async function r2Put(
  key: string,
  body: Buffer,
  contentType: string,
  options?: { cacheControl?: string; immutable?: boolean; isAvatar?: boolean },
): Promise<void> {
  const client = r2Client();
  const Bucket = await resolvedBucket();
  const normalized = normalizeR2Key(key);

  let cacheControl = options?.cacheControl;
  if (!cacheControl) {
    if (options?.isAvatar) {
      cacheControl = "public, max-age=86400";
    } else if (options?.immutable ?? true) {
      cacheControl = "public, max-age=31536000, immutable";
    } else {
      cacheControl = "public, max-age=3600";
    }
  }

  await client.send(
    new PutObjectCommand({
      Bucket,
      Key: normalized,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
}

export async function r2Delete(keys: string[]): Promise<void> {
  const uniq = [...new Set(keys.map(normalizeR2Key).filter(Boolean))];
  if (uniq.length === 0) return;
  const client = r2Client();
  const Bucket = await resolvedBucket();
  await client.send(
    new DeleteObjectsCommand({
      Bucket,
      Delete: {
        Objects: uniq.map((Key) => ({ Key })),
        Quiet: true,
      },
    }),
  );
}

export async function r2DeleteWithVariants(keys: string[]): Promise<void> {
  const expanded = new Set<string>();
  for (const k of keys) {
    for (const e of expandR2DeleteKeys(k)) expanded.add(e);
  }
  await r2Delete([...expanded]);
}

export async function r2Exists(key: string): Promise<boolean> {
  const client = r2Client();
  const Bucket = await resolvedBucket();
  try {
    await client.send(
      new HeadObjectCommand({ Bucket, Key: normalizeR2Key(key) }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function r2Get(key: string): Promise<Buffer> {
  const client = r2Client();
  const Bucket = await resolvedBucket();
  const res = await client.send(
    new GetObjectCommand({ Bucket, Key: normalizeR2Key(key) }),
  );
  const body = res.Body;
  if (!body) throw new Error(`R2 GetObject: leerer Body (${key})`);
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function r2PutCopyFromBuffer(
  fromKey: string,
  toKey: string,
): Promise<void> {
  const buf = await r2Get(fromKey);
  const normalizedFrom = normalizeR2Key(fromKey);
  const headDot = normalizedFrom.lastIndexOf(".");
  const ext = headDot >= 0 ? normalizedFrom.slice(headDot).toLowerCase() : "";
  const contentType =
    ext === ".webp"
      ? "image/webp"
      : ext === ".png"
        ? "image/png"
        : "image/jpeg";

  await r2Put(normalizeR2Key(toKey), buf, contentType, {
    immutable: true,
  });
}
