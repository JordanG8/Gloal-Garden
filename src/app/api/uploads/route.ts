import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth-helpers';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
// Data-URL fallback rows live in Postgres — keep them small. The client
// compresses to well under this before uploading.
const MAX_INLINE_BYTES = 1.5 * 1024 * 1024;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Photo uploads from the camera / gallery picker. Stores in Vercel Blob when
 * BLOB_READ_WRITE_TOKEN is configured; otherwise falls back to returning a
 * compact data URL that is persisted in the observation row itself, so photo
 * logging works with zero storage configuration.
 */
export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'You must be signed in to upload photos.' }, { status: 401 });
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get('file');
    if (entry instanceof File) file = entry;
  } catch {
    return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 });
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No photo received.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, or WebP images are supported.' }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Photo is too large (8 MB max).' }, { status: 413 });
  }

  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import('@vercel/blob');
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const blob = await put(`plants/${userId}/${Date.now()}.${extension}`, file, {
        access: 'public',
        addRandomSuffix: true,
      });
      return NextResponse.json({ url: blob.url });
    }

    if (file.size > MAX_INLINE_BYTES) {
      return NextResponse.json(
        { error: 'Photo is too large. Try again — it will be compressed further.' },
        { status: 413 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    return NextResponse.json({ url: `data:${file.type};base64,${buffer.toString('base64')}` });
  } catch (error) {
    console.error('Photo upload failed:', error);
    return NextResponse.json({ error: 'Could not save the photo. Please try again.' }, { status: 500 });
  }
}
