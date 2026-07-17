'use client';

import { useState } from 'react';
import { Avatar } from '@/components/avatar';
import { Lightbox } from '@/components/lightbox';

/** Profile avatar that opens an Instagram-style fullscreen lightbox on tap. */
export function ZoomableAvatar({
  name,
  id,
  src,
  size,
  ring,
}: {
  name: string;
  id: number;
  src?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!src) {
    return <Avatar name={name} id={id} src={src} size={size} ring={ring} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={name}
        className="shrink-0 rounded-full active:scale-95"
      >
        <Avatar name={name} id={id} src={src} size={size} ring={ring} />
      </button>
      {open && <Lightbox src={src} alt={name} onClose={() => setOpen(false)} />}
    </>
  );
}
