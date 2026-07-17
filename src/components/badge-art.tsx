import type { Dictionary } from '@/i18n';

/** Filled mini-glyphs for the 12 badges, drawn in the Grove gold style. */
function BadgeGlyph({ id, size = 22 }: { id: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' } as const;
  switch (id) {
    case 'first_sprout':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <path d="M10 17C10 11 13 5 18 3C18 10 15 15 10 17Z" fill="#A98617" />
          <path d="M10 17C10 12 8 7 2 5C2 11 5 15 10 17Z" fill="#C9A22B" />
        </svg>
      );
    case 'green_thumb':
      return (
        <svg {...p}>
          <path d="M12 21C12 21 5 14.5 5 9.5C5 5.9 8.1 3 12 3C15.9 3 19 5.9 19 9.5C19 14.5 12 21 12 21Z" fill="#C9A22B" />
          <circle cx="12" cy="9.5" r="2.6" fill="#F4EACB" />
        </svg>
      );
    case 'first_harvest':
      return (
        <svg {...p}>
          <path d="M5 10H19L17.5 19H6.5L5 10Z" fill="#A98617" />
          <path d="M8.5 10C8.5 7 10 5 12 5C14 5 15.5 7 15.5 10" stroke="#A98617" strokeWidth="1.8" fill="none" />
        </svg>
      );
    case 'provider':
      return (
        <svg {...p}>
          <path d="M5 10H19L17.5 19H6.5L5 10Z" fill="#C9A22B" />
          <path d="M8.5 10C8.5 7 10 5 12 5C14 5 15.5 7 15.5 10" stroke="#A98617" strokeWidth="1.8" fill="none" />
          <path d="M12 1.5L12.9 3.9L15.5 4L13.5 5.7L14.1 8.2L12 6.8L9.9 8.2L10.5 5.7L8.5 4L11.1 3.9L12 1.5Z" fill="#A98617" />
        </svg>
      );
    case 'rainmaker':
      return (
        <svg {...p}>
          <path d="M12 3C12 3 6 10 6 14.5C6 17.8 8.7 20.5 12 20.5C15.3 20.5 18 17.8 18 14.5C18 10 12 3 12 3Z" fill="#C9A22B" />
          <path d="M9.5 14.5C9.5 16 10.6 17 12 17" stroke="#F4EACB" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'lifesaver':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" fill="#C9A22B" />
          <circle cx="12" cy="12" r="3.4" fill="#F4EACB" />
          <path d="M12 3.5V8M12 16V20.5M3.5 12H8M16 12H20.5" stroke="#A98617" strokeWidth="1.8" />
        </svg>
      );
    case 'good_neighbor':
      return (
        <svg {...p}>
          <path d="M12 21C8 17 5 13.5 5 10C5 7 7 5 9.5 5C10.5 5 11.5 5.5 12 6.3C12.5 5.5 13.5 5 14.5 5C17 5 19 7 19 10C19 13.5 16 17 12 21Z" fill="#A98617" />
        </svg>
      );
    case 'foster_gardener':
      return (
        <svg {...p}>
          <path d="M4 11C4 7 7 4 12 4C17 4 20 7 20 11V13C20 16.9 16.9 20 13 20H11C7.1 20 4 16.9 4 13V11Z" fill="#F4EACB" stroke="#A98617" strokeWidth="1.8" />
          <path d="M12 15C12 11.5 13.8 8.5 16.5 7.5C16.5 11.5 14.8 14 12 15Z" fill="#C9A22B" />
          <path d="M12 15C12 12.5 10.8 10 7.5 9C7.5 12.5 9.5 14.5 12 15Z" fill="#A98617" />
        </svg>
      );
    case 'watchful_eye':
      return (
        <svg {...p}>
          <path d="M2.5 12C4.5 7.5 8 5 12 5C16 5 19.5 7.5 21.5 12C19.5 16.5 16 19 12 19C8 19 4.5 16.5 2.5 12Z" fill="#F4EACB" stroke="#A98617" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.4" fill="#C9A22B" />
          <circle cx="12" cy="12" r="1.3" fill="#A98617" />
        </svg>
      );
    case 'documentarian':
      return (
        <svg {...p}>
          <rect x="3" y="7" width="18" height="13" rx="3" fill="#C9A22B" />
          <path d="M8 7L9.5 4.5H14.5L16 7" stroke="#A98617" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="13.5" r="3.4" fill="#F4EACB" />
        </svg>
      );
    case 'full_circle':
      return (
        <svg {...p}>
          <path d="M12 3A9 9 0 1 1 4.5 7" stroke="#A98617" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M4.5 3V7H8.5" stroke="#A98617" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M12 16C12 12.5 13.8 9.5 16.5 8.5C16.5 12.5 14.8 15 12 16Z" fill="#C9A22B" />
        </svg>
      );
    case 'garden_elder':
      return (
        <svg {...p}>
          <path d="M3 15H21L19.5 6.5L15 10L12 3.5L9 10L4.5 6.5L3 15Z" fill="#C9A22B" />
          <rect x="4.5" y="17" width="15" height="3" rx="1.5" fill="#A98617" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8" fill="#C9A22B" />
        </svg>
      );
  }
}

export function badgeName(id: string, dict: Dictionary): string {
  const entry = dict.badges[id as keyof typeof dict.badges];
  return typeof entry === 'object' ? entry.name : id;
}

export function badgeDesc(id: string, dict: Dictionary): string {
  const entry = dict.badges[id as keyof typeof dict.badges];
  return typeof entry === 'object' ? entry.desc : '';
}

/**
 * Badge tile per the design: earned = gold tint card, locked = dashed outline
 * showing progress toward the threshold instead of the name.
 */
export function BadgeTile({
  id,
  dict,
  earned,
  progress,
  showDesc = false,
}: {
  id: string;
  dict: Dictionary;
  earned: boolean;
  progress?: { have: number; need: number };
  showDesc?: boolean;
}) {
  if (!earned) {
    return (
      <div
        className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-[#D8D2C2] bg-[#F1EEE5] px-1.5 py-3 opacity-80"
        title={badgeDesc(id, dict)}
      >
        <span className="grayscale opacity-50">
          <BadgeGlyph id={id} />
        </span>
        <span className="text-center text-[9.5px] font-bold tracking-[0.04em] text-faint tabular-nums">
          {progress ? `${Math.min(progress.have, progress.need)}/${progress.need}` : '?'}
        </span>
        {showDesc && <span className="text-center text-[9px] leading-tight text-faint">{badgeDesc(id, dict)}</span>}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-gold-line bg-gold-tint px-1.5 py-3"
      title={badgeDesc(id, dict)}
    >
      <BadgeGlyph id={id} />
      <span className="text-center text-[9.5px] font-bold uppercase tracking-[0.04em] text-gold-ink leading-tight">
        {badgeName(id, dict)}
      </span>
      {showDesc && <span className="text-center text-[9px] leading-tight text-[#8A7530]">{badgeDesc(id, dict)}</span>}
    </div>
  );
}

/** Large glyph reuse for the karma-moment unlock card. */
export { BadgeGlyph };
