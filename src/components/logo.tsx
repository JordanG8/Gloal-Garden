/** The Grove leaf mark — gold + green leaves on a forest tile. */
export function LeafMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 17C10 11 13 5 18 3C18 10 15 15 10 17Z" fill="#C9A22B" />
      <path d="M10 17C10 12 8 7 2 5C2 11 5 15 10 17Z" fill="#7FB88B" />
      <path d="M10 17V9" stroke="#FAF8F2" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({
  tile = 30,
  text = 17,
  tone = 'light',
  name,
}: {
  tile?: number;
  text?: number;
  tone?: 'light' | 'dark';
  name: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex items-center justify-center rounded-[30%] ${tone === 'dark' ? 'bg-white/10' : 'bg-forest'}`}
        style={{ width: tile, height: tile }}
      >
        <LeafMark size={Math.round(tile * 0.53)} />
      </div>
      <span
        className={`font-display font-semibold uppercase ${tone === 'dark' ? 'text-[#DCE7D6]' : 'text-forest'}`}
        style={{ fontSize: text, letterSpacing: '0.14em' }}
      >
        {name}
      </span>
    </div>
  );
}
