import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const useS3 = !!process.env.S3_ENDPOINT && !!process.env.S3_ACCESS_KEY;
const bucket = process.env.S3_BUCKET ?? "law-office";
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
const LINK_TTL_SECONDS = 300;

const s3 = useS3
  ? new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "me-central-1",
      forcePathStyle: true,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
    })
  : null;

export async function putFile(file: File, prefix: string) {
  const ext = path.extname(file.name).slice(0, 10);
  const key = `${prefix}/${new Date().getFullYear()}/${randomUUID()}${ext}`;
  const body = Buffer.from(await file.arrayBuffer());
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: file.type || "application/octet-stream" }));
  } else {
    const target = path.join(uploadDir, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }
  return { key, size: body.length, mimeType: file.type || "application/octet-stream", fileName: file.name };
}

export async function readLocalFile(key: string) {
  const target = path.resolve(uploadDir, key);
  if (!target.startsWith(uploadDir)) throw new Error("Invalid key");
  return readFile(target);
}

const sign = (payload: string) => createHmac("sha256", process.env.AUTH_SECRET ?? "dev").update(payload).digest("hex");

/** Returns a short-lived download URL (S3 presigned URL, or an HMAC-signed local URL). */
export async function signedUrl(key: string, fileName: string) {
  if (s3) {
    return getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}` }),
      { expiresIn: LINK_TTL_SECONDS },
    );
  }
  const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
  const payload = `${key}|${exp}`;
  return `/api/files?key=${encodeURIComponent(key)}&exp=${exp}&name=${encodeURIComponent(fileName)}&sig=${sign(payload)}`;
}

export function verifyLocalSignature(key: string, exp: string, sig: string) {
  if (Number(exp) < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(`${key}|${exp}`));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function getFileBuffer(key: string) {
  if (s3) {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  return readLocalFile(key);
}
