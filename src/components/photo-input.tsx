"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, X, Loader2 } from "lucide-react";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Downscale + re-encode client-side so phone photos (often 5–15 MB) become
 * a few hundred KB before they ever hit the network. Also normalizes EXIF
 * rotation via createImageBitmap.
 */
async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Some older browsers can't decode via createImageBitmap — send as-is.
    return file;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  return blob ?? file;
}

/**
 * Photo picker for care logs: take a picture with the phone camera or choose
 * one from the gallery. Uploads immediately and exposes the stored URL via a
 * hidden form field, so parent forms just read `formData.get(name)`.
 */
export default function PhotoInput({
  name,
  label = "Photo",
  onChange,
}: {
  name: string;
  label?: string;
  onChange?: (url: string) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function setPhoto(nextUrl: string, nextPreview: string) {
    setUrl(nextUrl);
    setPreview((old) => {
      if (old.startsWith("blob:")) URL.revokeObjectURL(old);
      return nextPreview;
    });
    onChange?.(nextUrl);
  }

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image.");
      return;
    }
    setError("");
    setUploading(true);
    setPhoto("", URL.createObjectURL(file));

    try {
      const compressed = await compressImage(file);
      const body = new FormData();
      body.append("file", compressed, "photo.jpg");
      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        throw new Error(data?.error ?? "Upload failed. Please try again.");
      }
      setUrl(data.url);
      onChange?.(data.url);
    } catch (err) {
      setPhoto("", "");
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function clearPhoto() {
    setPhoto("", "");
    setError("");
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  return (
    <div>
      <input type="hidden" name={name} value={url} />
      {/* capture="environment" opens the rear camera directly on phones */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {preview ? (
        <div className="relative overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected plant photo" className="h-44 w-full object-cover" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.75} />
            </div>
          )}
          <button
            type="button"
            onClick={clearPhoto}
            className="absolute right-2.5 top-2.5 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/70"
            aria-label="Remove photo"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-border bg-background py-4 text-muted-foreground transition hover:border-primary/50 hover:text-primary"
            >
              <Camera className="h-5 w-5" strokeWidth={1.75} />
              <span className="text-xs font-medium">Take photo</span>
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-border bg-background py-4 text-muted-foreground transition hover:border-primary/50 hover:text-primary"
            >
              <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
              <span className="text-xs font-medium">From gallery</span>
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
