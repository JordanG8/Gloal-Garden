'use client';

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { IconCamera, IconClose } from './icons';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Downscale + re-encode client-side so phone photos (often 5–15 MB) become a
 * few hundred KB before they ever hit the network. Also normalizes EXIF
 * rotation via createImageBitmap, so photos from any OS come out upright.
 */
async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  );
  return blob ?? file;
}

/**
 * Photo picker: camera on phones (capture="environment"), file picker on
 * desktop — one tap opens the OS chooser which offers both where available.
 * Uploads immediately; exposes the stored URL via a hidden form field.
 */
export default function PhotoInput({
  name,
  label,
  height = 120,
  round = false,
  initialUrl = '',
  onChange,
}: {
  name: string;
  label: string;
  height?: number;
  round?: boolean;
  initialUrl?: string;
  onChange?: (url: string) => void;
}) {
  const { dict } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [preview, setPreview] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function setPhoto(nextUrl: string, nextPreview: string) {
    setUrl(nextUrl);
    setPreview((old) => {
      if (old.startsWith('blob:')) URL.revokeObjectURL(old);
      return nextPreview;
    });
    onChange?.(nextUrl);
  }

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(dict.common.notAnImage);
      return;
    }
    setError('');
    setUploading(true);
    setPhoto('', URL.createObjectURL(file));

    try {
      const compressed = await compressImage(file);
      const body = new FormData();
      body.append('file', compressed, 'photo.jpg');
      const res = await fetch('/api/uploads', { method: 'POST', body });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        throw new Error(data?.error ?? dict.common.uploadFailed);
      }
      setUrl(data.url);
      onChange?.(data.url);
    } catch (err) {
      setPhoto('', '');
      setError(err instanceof Error ? err.message : dict.common.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  const radiusCls = round ? 'rounded-full' : 'rounded-2xl';

  return (
    <div className={round ? 'inline-block' : ''}>
      <input type="hidden" name={name} value={url} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {preview ? (
        <div
          className={`relative overflow-hidden border border-line ${radiusCls}`}
          style={round ? { width: height, height } : { height }}
        >
          <img src={preview} alt="" className="h-full w-full object-cover" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/45">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-cream border-t-transparent" />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setPhoto('', '');
              setError('');
            }}
            className="absolute end-2 top-2 rounded-full bg-ink/55 p-1.5 text-white backdrop-blur-sm transition hover:bg-ink/75"
            aria-label={dict.common.removePhoto}
          >
            <IconClose size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`relative flex w-full flex-col items-center justify-center gap-2 border-[1.5px] border-dashed border-[#C9BFA8] bg-cream text-muted-foreground transition hover:border-forest hover:text-forest active:scale-[0.99] ${radiusCls}`}
          style={round ? { width: height, height } : { height }}
        >
          <IconCamera size={round ? 22 : 24} />
          {!round && <span className="px-4 text-center text-[12.5px] font-semibold">{label}</span>}
        </button>
      )}

      {error && <p className="mt-2 text-[12.5px] font-medium text-destructive">{error}</p>}
    </div>
  );
}
