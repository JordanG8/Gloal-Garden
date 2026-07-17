/** Big condensed number + tiny uppercase label — the Grove stat unit. */
export function Stat({
  value,
  label,
  size = 30,
  tone = 'ink',
  align = 'start',
}: {
  value: React.ReactNode;
  label: string;
  size?: number;
  tone?: 'ink' | 'gold' | 'cream' | 'cream-dim';
  align?: 'start' | 'center' | 'end';
}) {
  const color =
    tone === 'gold'
      ? 'text-gold-deep'
      : tone === 'cream'
        ? 'text-cream'
        : tone === 'cream-dim'
          ? 'text-cream/90'
          : 'text-ink';
  const labelColor = tone === 'cream' || tone === 'cream-dim' ? 'text-cream/50' : 'text-bark';
  const alignCls = align === 'center' ? 'items-center text-center' : align === 'end' ? 'items-end text-end' : 'items-start';

  return (
    <div className={`flex flex-col gap-1 ${alignCls}`}>
      <div className={`stat-number ${color}`} style={{ fontSize: size }}>
        {value}
      </div>
      <div className={`microlabel ${labelColor}`}>{label}</div>
    </div>
  );
}

/** White bordered card holding a row of centered stats with dividers. */
export function StatCardRow({ stats }: { stats: { value: React.ReactNode; label: string; gold?: boolean }[] }) {
  return (
    <div className="flex rounded-2xl border border-line bg-card px-2 py-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`flex-1 text-center ${i < stats.length - 1 ? 'border-e border-chip' : ''}`}
        >
          <div className={`stat-number text-[34px] ${stat.gold ? 'text-gold-deep' : 'text-ink'}`}>{stat.value}</div>
          <div className="microlabel mt-1 text-bark">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

/** Gradient level progress bar (leaf → gold). */
export function LevelBar({ percent, dark = false }: { percent: number; dark?: boolean }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full ${dark ? 'bg-cream/15' : 'bg-chip'}`}>
      <div
        className="animate-bar-fill h-full rounded-full"
        style={{
          width: `${Math.min(100, Math.max(2, percent))}%`,
          background: 'linear-gradient(90deg, #3B8455, #C9A22B)',
        }}
      />
    </div>
  );
}
