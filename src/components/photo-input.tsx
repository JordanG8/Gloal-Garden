'use client';

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/i18n/provider';
import { IconCamera, IconClose, IconImage } from './icons';
import { CameraCapture } from '@/components/camera-capture';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Downscale + re-encode client-side so phone photos (often 5–15 MB) become a
 * few hundred KB before they ever hit the network. Also normalizes EXIF
 * rotation via createImageBitmap, so photos from any OS come out upright.
 */
async function compressImage(file: Blob): Promise<Blob> {
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  function setPhoto(nextUrl: string, nextPreview: string) {
    setUrl(nextUrl);
    setPreview((old) => {
      if (old.startsWith('blob:')) URL.revokeObjectURL(old);
      return nextPreview;
    });
    onChange?.(nextUrl);
  }

  async function upload(blob: Blob) {
    setError('');
    setUploading(true);
    setPhoto('', URL.createObjectURL(blob));

    try {
      const compressed = await compressImage(blob);
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

  function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(dict.common.notAnImage);
      return;
    }
    upload(file);
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
          onClick={() => setSheetOpen(true)}
          className={`relative flex w-full flex-col items-center justify-center gap-2 border-[1.5px] border-dashed border-[#C9BFA8] bg-cream text-muted-foreground transition hover:border-forest hover:text-forest active:scale-[0.99] ${radiusCls}`}
          style={round ? { width: height, height } : { height }}
        >
          <IconCamera size={round ? 22 : 24} />
          {!round && <span className="px-4 text-center text-[12.5px] font-semibold">{label}</span>}
        </button>
      )}

      {error && <p className="mt-2 text-[12.5px] font-medium text-destructive">{error}</p>}

      {sheetOpen &&
        createPortal(
          <>
            <button
              aria-label={dict.common.close}
              className="animate-fade fixed inset-0 z-40 bg-ink/25"
              onClick={() => setSheetOpen(false)}
            />
            <div className="animate-sheet-up fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[520px] flex-col gap-1.5 rounded-t-[28px] bg-cream px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 shadow-[0_-12px_40px_rgba(32,37,28,0.25)]">
              <div className="flex justify-center pb-2">
                <div className="h-[5px] w-10 rounded-full bg-[#D8D2C2]" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  setCameraOpen(true);
                }}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 text-start transition hover:bg-chip"
              >
                <IconCamera size={20} className="text-forest" />
                <span className="text-[14.5px] font-semibold text-ink">{dict.common.takePhoto}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  inputRef.current?.click();
                }}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 text-start transition hover:bg-chip"
              >
                <IconImage size={20} className="text-forest" />
                <span className="text-[14.5px] font-semibold text-ink">{dict.common.fromGallery}</span>
              </button>
            </div>
          </>,
          document.body
        )}

      {cameraOpen && (
        <CameraCapture
          onClose={() => setCameraOpen(false)}
          onCapture={(blob) => {
            setCameraOpen(false);
            upload(blob);
          }}
        />
      )}
    </div>
  );
}
