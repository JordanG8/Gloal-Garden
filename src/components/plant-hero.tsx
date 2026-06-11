import { STATUS_BADGE_CLASSES } from "@/lib/plant-status";

export interface HeroPlant {
  emoji: string;
  name: string;
  status: string;
  speciesName: string;
  scientificName: string;
}

/**
 * Full-page plant hero. Rendered identically by the expansion overlay and the
 * plant page so the card → page hand-off is pixel-continuous.
 */
export default function PlantHero({ plant, children }: { plant: HeroPlant; children?: React.ReactNode }) {
  return (
    <div className="relative h-64 md:h-80 shrink-0 flex items-end overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-brand-primary-light">
      <span className="absolute -right-4 -top-6 text-[11rem] md:text-[16rem] leading-none opacity-20 select-none">
        {plant.emoji}
      </span>

      {children}

      <div className="relative z-10 p-6 md:p-10 text-white w-full max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-3xl">{plant.emoji}</span>
          <span
            className={`px-2 py-0.5 backdrop-blur-md rounded text-xs font-bold uppercase tracking-wider ${STATUS_BADGE_CLASSES[plant.status] ?? "bg-primary/80"}`}
          >
            {plant.status.replace(/_/g, " ")}
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-heading font-bold">{plant.name}</h1>
        <p className="text-sm md:text-base text-white/80 italic">
          {plant.speciesName} · {plant.scientificName}
        </p>
      </div>
    </div>
  );
}
