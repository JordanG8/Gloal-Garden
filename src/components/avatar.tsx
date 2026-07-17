/* eslint-disable @next/next/no-img-element */

const AVATAR_COLORS = ['#17402B', '#6A4E37', '#3B8455', '#4B87A8', '#A78E70', '#0F2E1E'];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  const first = [...parts[0]][0] ?? '';
  const second = parts.length > 1 ? [...parts[parts.length - 1]][0] ?? '' : '';
  return (first + second).toUpperCase();
}

export function avatarColor(id: number): string {
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
}

/**
 * User avatar: uploaded photo when present, otherwise bold condensed initials
 * on a deterministic Grove color. `ring` adds the gold achievement ring.
 */
export function Avatar({
  name,
  id,
  src,
  size = 36,
  ring = false,
  className = '',
}: {
  name: string;
  id: number;
  src?: string | null;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const ringStyle = ring ? { border: `${size >= 56 ? 3 : 2.5}px solid #C9A22B` } : undefined;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size, ...ringStyle }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full font-display font-bold text-cream shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        background: avatarColor(id),
        fontSize: Math.round(size * 0.4),
        ...ringStyle,
      }}
      aria-hidden
    >
      {initialsOf(name)}
    </div>
  );
}
