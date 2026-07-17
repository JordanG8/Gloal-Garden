import type { Dictionary } from '@/i18n';
import type { PlantStatus } from '@/lib/plant-status';

/** Solid pin/pill color per plant status (Grove status scale). */
export const STATUS_COLOR: Record<string, string> = {
  growing: '#3B8455',
  needs_water: '#4B87A8',
  ready_to_harvest: '#C9A22B',
  needs_attention: '#B65A32',
  diseased: '#B65A32',
  dormant: '#8A6E4F',
  steward: '#8A6E4F',
};

export function statusLabel(status: PlantStatus | 'steward', dict: Dictionary): string {
  if (status === 'steward') return dict.status.needsSteward;
  return dict.status[status as keyof typeof dict.status] ?? status;
}

export function StatusPill({
  status,
  dict,
  className = '',
}: {
  status: PlantStatus | 'steward';
  dict: Dictionary;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white whitespace-nowrap ${className}`}
      style={{ background: STATUS_COLOR[status] ?? '#3B8455' }}
    >
      {statusLabel(status, dict)}
    </span>
  );
}

export function GlassPill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-white/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-sm whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

/** Gold karma amount chip: +15 */
export function KarmaChip({ points, className = '' }: { points: number; className?: string }) {
  if (points <= 0) {
    return (
      <span className={`inline-flex items-center rounded-full bg-chip px-2.5 py-1 text-[11.5px] font-bold text-faint ${className}`}>
        ·
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full bg-gold-tint px-2.5 py-1 text-[11.5px] font-bold text-[#8A7530] tabular-nums ${className}`}
    >
      +{points}
    </span>
  );
}

/** Moss level chip: SPROUT */
export function LevelChip({ label, gold = false }: { label: string; gold?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] ${
        gold ? 'bg-gold-tint text-[#8A7530]' : 'bg-moss text-forest'
      }`}
    >
      {label}
    </span>
  );
}
