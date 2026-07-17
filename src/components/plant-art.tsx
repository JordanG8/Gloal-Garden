/* eslint-disable @next/next/no-img-element */

/**
 * Generated plant visuals: when a plant has no photo yet, its hero and thumbs
 * render branded art — layered leaf shapes on a category-tinted gradient — so
 * nothing in the app is ever a gray box.
 */

const CATEGORY_TONES: Record<string, { from: string; to: string; leaf1: string; leaf2: string }> = {
  vegetable: { from: '#DFE9D1', to: '#F0EDE2', leaf1: '#3B8455', leaf2: '#7FB88B' },
  fruit: { from: '#F4EACB', to: '#F6F1E3', leaf1: '#C9A22B', leaf2: '#3B8455' },
  herb: { from: '#E7EFE2', to: '#F2F5EC', leaf1: '#3B8455', leaf2: '#17402B' },
  tree: { from: '#E3EBD6', to: '#EFEAD9', leaf1: '#17402B', leaf2: '#6A4E37' },
};

export function PlantArt({
  category,
  emoji,
  className = '',
  emojiSize = 44,
}: {
  category: string;
  emoji?: string | null;
  className?: string;
  emojiSize?: number;
}) {
  const tone = CATEGORY_TONES[category] ?? CATEGORY_TONES.vegetable;
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: `linear-gradient(150deg, ${tone.from}, ${tone.to})` }}
      aria-hidden
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <path d="M-20 210C30 150 40 90 20 30C90 60 110 130 80 210Z" fill={tone.leaf1} opacity="0.14" />
        <path d="M220 220C170 170 160 110 185 40C115 80 100 150 140 220Z" fill={tone.leaf2} opacity="0.12" />
        <path d="M100 190C100 140 120 90 165 70C160 130 140 170 100 190Z" fill={tone.leaf1} opacity="0.1" />
      </svg>
      {emoji && (
        <span className="relative select-none" style={{ fontSize: emojiSize, lineHeight: 1 }}>
          {emoji}
        </span>
      )}
    </div>
  );
}

/** Photo when available, branded art otherwise. */
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
    return <img src={photoUrl} alt={alt} className={`object-cover ${className}`} />;
  }
  return <PlantArt category={category} emoji={emoji} className={className} emojiSize={emojiSize} />;
}
