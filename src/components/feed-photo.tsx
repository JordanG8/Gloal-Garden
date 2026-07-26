'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { Lightbox } from '@/components/lightbox';

/** Feed thumbnail that opens fullscreen in the shared Lightbox on tap. */
export function FeedPhoto({ src, alt, className }: { src: string; alt: string; className: string }) {
  const { dict } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={dict.plantCard.photos}
        className="shrink-0 transition active:scale-95"
      >
        <img src={src} alt={alt} loading="lazy" decoding="async" className={className} />
      </button>
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
