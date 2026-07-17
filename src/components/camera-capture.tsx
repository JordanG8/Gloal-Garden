'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/i18n/provider';
import { IconClose, IconFlipCamera, IconCheck } from '@/components/icons';

/**
 * Fullscreen in-app camera: live getUserMedia preview, shutter, front/back
 * flip, and a still-frame confirm step before handing the blob back —
 * captures a real photo without ever leaving the app or the OS picker.
 */
export function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}) {
  const { dict } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [stillUrl, setStillUrl] = useState('');
  const stillBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (stillUrl) return undefined; // don't restart the stream while reviewing a still

    if (!navigator.mediaDevices?.getUserMedia) {
      // Deferred so this isn't a synchronous setState call from inside the
      // effect body — it runs as a resolved-promise callback instead.
      Promise.resolve().then(() => setError(dict.common.cameraError));
      return undefined;
    }

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);
        setError('');
      })
      .catch(() => {
        if (!cancelled) setError(dict.common.cameraError);
      });

    return () => {
      cancelled = true;
      setReady(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode, stillUrl, dict.common.cameraError]);

  useEffect(
    () => () => {
      if (stillUrl) URL.revokeObjectURL(stillUrl);
    },
    [stillUrl]
  );

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (facingMode === 'user') {
      // Un-mirror the selfie preview so the saved photo reads correctly.
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stillBlobRef.current = blob;
        setStillUrl(URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.92
    );
  }

  function retake() {
    setStillUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return '';
    });
    stillBlobRef.current = null;
  }

  function usePhoto() {
    if (stillBlobRef.current) onCapture(stillBlobRef.current);
  }

  // Portalled to <body> — a fixed-position overlay must escape any ancestor
  // that CSS treats as a containing block (e.g. an `animate-rise` element,
  // whose transform lingers via animation-fill-mode after it finishes).
  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-[14px] font-medium text-white">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white px-6 py-3 text-[14px] font-semibold text-ink"
          >
            {dict.common.close}
          </button>
        </div>
      ) : stillUrl ? (
        <>
          <img src={stillUrl} alt="" className="h-full w-full flex-1 object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-6 pb-[max(env(safe-area-inset-bottom),28px)] pt-6">
            <button
              type="button"
              onClick={retake}
              className="rounded-full bg-white/15 px-6 py-3.5 text-[14px] font-semibold text-white backdrop-blur-sm"
            >
              {dict.common.retake}
            </button>
            <button
              type="button"
              onClick={usePhoto}
              className="flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[14px] font-semibold text-ink active:scale-95"
            >
              <IconCheck size={16} />
              {dict.common.usePhoto}
            </button>
          </div>
        </>
      ) : (
        <>
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className={`h-full w-full flex-1 object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.common.close}
            className="absolute end-4 top-[max(env(safe-area-inset-top),16px)] flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
          >
            <IconClose size={18} />
          </button>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-10 pb-[max(env(safe-area-inset-bottom),28px)] pt-6">
            <button
              type="button"
              onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
              aria-label={dict.common.flipCamera}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm"
            >
              <IconFlipCamera size={20} />
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={capture}
              aria-label={dict.common.takePhoto}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[4px] border-white bg-white/20 transition active:scale-95 disabled:opacity-50"
            >
              <span className="h-[58px] w-[58px] rounded-full bg-white" />
            </button>
            <div className="h-11 w-11" />
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
