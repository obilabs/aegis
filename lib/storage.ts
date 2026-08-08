import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET = process.env.S3_BUCKET || 'aegis-uploads'
const MAX_UPLOAD_SIZE = (parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50', 10)) * 1024 * 1024

// MIME types allowed for document attachments
const ALLOWED_MIME_TYPES = new Set([
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/rtf',
  'text/plain',
  'text/csv',
  'text/markdown',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Archives
  'application/zip',
  'application/gzip',
])

// Image types allowed for public assets (embeddable)
const PUBLIC_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
])

let _client: S3Client | null = null

function getClient(): S3Client {
  if (_client) return _client
  _client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin123',
    },
    forcePathStyle: true, // Required for MinIO
  })
  return _client
}

/**
 * Build a storage key for a private document attachment.
 * Path: {orgId}/documents/{docId}/{filename}
 */
export function buildDocumentKey(orgId: string, docId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${orgId}/documents/${docId}/${Date.now()}-${safe}`
}

/**
 * Build a storage key for a public asset (images for embedding).
 * Path: public/{orgId}/{filename}
 */
export function buildPublicKey(orgId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `public/${orgId}/${Date.now()}-${safe}`
}

/**
 * Upload a file to S3/MinIO.
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

/**
 * Download a file from S3/MinIO as a readable stream.
 */
export async function downloadFile(key: string): Promise<{
  body: ReadableStream | NodeJS.ReadableStream
  contentType: string
  contentLength: number
}> {
  const res = await getClient().send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  )
  return {
    body: res.Body as ReadableStream,
    contentType: res.ContentType || 'application/octet-stream',
    contentLength: res.ContentLength || 0,
  }
}

/**
 * Generate a presigned download URL (expires in 15 minutes).
 */
export async function getPresignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds })
}

/**
 * Delete a file from S3/MinIO.
 */
export async function deleteFile(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: BUCKET, Key: key }),
  )
}

/**
 * Check if a file exists in S3/MinIO.
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    await getClient().send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: key }),
    )
    return true
  } catch {
    return false
  }
}

/**
 * Validate file for document attachment upload.
 */
export function validateUpload(
  size: number,
  mimeType: string,
): { valid: boolean; error?: string } {
  if (size > MAX_UPLOAD_SIZE) {
    const maxMB = MAX_UPLOAD_SIZE / (1024 * 1024)
    return { valid: false, error: `File exceeds maximum size of ${maxMB}MB` }
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, error: `File type ${mimeType} is not allowed` }
  }
  return { valid: true }
}

/**
 * Validate file for public asset upload (images only).
 */
export function validatePublicUpload(
  size: number,
  mimeType: string,
): { valid: boolean; error?: string } {
  if (size > 10 * 1024 * 1024) { // 10MB limit for public images
    return { valid: false, error: 'Public images must be under 10MB' }
  }
  if (!PUBLIC_IMAGE_TYPES.has(mimeType)) {
    return { valid: false, error: 'Only image files (JPEG, PNG, GIF, WebP, SVG) can be uploaded as public assets' }
  }
  return { valid: true }
}
