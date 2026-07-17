/* eslint-disable @next/next/no-img-element */

import { LeafMark } from '@/components/logo';

/**
 * Generated plant visuals: when a plant has no photo yet, its hero and thumbs
 * show the app's own mark on a solid forest-green tile — the same brand tile
 * used for the logo — so nothing in the app is ever a gray box, and every
 * placeholder reads unmistakably as "this one's ours, no photo yet" rather
 * than as a broken image.
 */

export function PlantArt({
  className = '',
  emojiSize = 44,
}: {
  /** Kept for call-site compatibility; the placeholder is brand-only now. */
  category?: string;
  emoji?: string | null;
  className?: string;
  emojiSize?: number;
}) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-forest ${className}`}
      aria-hidden
    >
      <LeafMark size={Math.round(emojiSize * 1.3)} />
    </div>
  );
}

/** Highly-compressed latest photo when available, branded logo tile otherwise. */
export function PlantImage({
  photoUrl,
  category,
  emoji,
  alt,
  className = '',
  emojiSize,
}: {
  photoUrl?: string | null;
  category: string;
  emoji?: string | null;
  alt: string;
  className?: string;
  emojiSize?: number;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`object-cover ${className}`}
      />
    );
  }
  return <PlantArt category={category} emoji={emoji} className={className} emojiSize={emojiSize} />;
}
