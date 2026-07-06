import { getPlantDetail } from "@/lib/data";
import { getSessionUser } from "@/lib/auth-helpers";
import { canEditPlant } from "@/lib/karma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Map as MapIcon, MapPin, Droplet, CalendarClock, Sun, Camera } from "lucide-react";
import type { Metadata } from "next";
import { STATUS_BADGE_CLASSES } from "@/lib/plant-status";
import { daysAgoLabel } from "@/lib/format";
import CareActions from "@/components/plant-care";
import ActivityFeed from "@/components/activity-feed";
import StewardSection from "@/components/steward-section";
import EditPlantDetails from "@/components/edit-plant-details";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const detail = await getPlantDetail(parseInt(id, 10));
  if (!detail) return { title: "Plant not found · Global Garden" };

  const { plant } = detail;
  return {
    title: `${plant.emoji} ${plant.name} · Global Garden`,
    description: `${plant.speciesName} (${plant.scientificName}) growing in public — planted by ${plant.plantedByName}, currently ${plant.status.replace(/_/g, " ")}. Help keep it alive on Global Garden.`,
  };
}

export default async function PlantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plantId = parseInt(id, 10);
  if (!Number.isFinite(plantId)) notFound();

  const [user, detail] = await Promise.all([getSessionUser(), getPlantDetail(plantId)]);
  if (!detail) notFound();

  const { plant, observations, stewards, verified } = detail;

  const viewerSteward = user ? stewards.find((s) => s.id === user.id) : undefined;
  const canEdit =
    !!user &&
    canEditPlant({
      karma: user.karma,
      isFounder: plant.founderId === user.id,
      isSteward: !!viewerSteward,
      isActiveSteward: viewerSteward?.active ?? false,
    });

  return (
    <main className="min-h-screen bg-background">
      {/* Hero — mirrors the panel/overlay hero for a seamless hand-off */}
      <div className="relative h-64 md:h-80 flex items-end overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-brand-primary-light">
        <span className="absolute -right-4 -top-6 text-[11rem] md:text-[16rem] leading-none opacity-20 select-none">
          {plant.emoji}
        </span>

        <Link
          href={`/?plant=${plant.id}`}
          className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/30 text-white px-4 py-2 rounded-full hover:bg-black/50 backdrop-blur-md text-sm font-medium"
        >
          <MapIcon className="w-4 h-4" /> Back to map
        </Link>

        <div className="relative z-10 p-6 md:p-10 text-white w-full max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-3xl">{plant.emoji}</span>
            <span
              className={`px-2 py-0.5 backdrop-blur-md rounded text-xs font-bold uppercase tracking-wider ${STATUS_BADGE_CLASSES[plant.status] ?? "bg-primary/80"}`}
            >
              {plant.status.replace(/_/g, " ")}
            </span>
            {plant.upForAdoption && (
              <span className="px-2 py-0.5 backdrop-blur-md rounded text-xs font-bold uppercase tracking-wider bg-amber-500/90">
                Needs a steward
              </span>
            )}
            {!verified && (
              <span className="px-2 py-0.5 backdrop-blur-md rounded text-xs font-bold uppercase tracking-wider bg-black/30 flex items-center gap-1">
                <Camera className="w-3 h-3" /> Needs photo verification
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold">{plant.name}</h1>
          <p className="text-sm md:text-base text-white/80 italic">
            {plant.speciesName} · {plant.scientificName}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-5 md:p-10 animate-[content-rise_0.5s_cubic-bezier(0.32,0.72,0,1)]">
        {/* Vitals */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-secondary/50 rounded-xl p-3 md:p-4 text-center border border-border/50">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Planted</p>
            <p className="font-mono text-sm md:text-base font-bold text-foreground">{daysAgoLabel(plant.plantedAt)}</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3 md:p-4 text-center border border-border/50">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Watered</p>
            <p className="font-mono text-sm md:text-base font-bold text-foreground">{daysAgoLabel(plant.lastWateredAt)}</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3 md:p-4 text-center border border-border/50">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Planted by</p>
            <Link
              href={`/users/${plant.founderId}`}
              className="font-mono text-sm md:text-base font-bold text-primary truncate px-1 block hover:underline"
            >
              {plant.plantedByName}
            </Link>
          </div>
        </div>

        <StewardSection
          plantId={plant.id}
          founderId={plant.founderId}
          founderName={plant.plantedByName}
          upForAdoption={plant.upForAdoption}
          stewardCount={stewards.length}
          stewards={stewards}
          user={user}
        />

        {/* Species care facts */}
        <div className="flex flex-wrap gap-2 mb-6 text-sm">
          {plant.wateringFrequencyDays && (
            <span className="flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-full">
              <Droplet className="w-3.5 h-3.5" /> Water every {plant.wateringFrequencyDays}d
            </span>
          )}
          {plant.daysToHarvest && (
            <span className="flex items-center gap-1.5 bg-secondary text-secondary-foreground border border-border px-3 py-1.5 rounded-full">
              <CalendarClock className="w-3.5 h-3.5" /> ~{plant.daysToHarvest}d to harvest
            </span>
          )}
          <span className="flex items-center gap-1.5 bg-secondary text-secondary-foreground border border-border px-3 py-1.5 rounded-full capitalize">
            <Sun className="w-3.5 h-3.5" /> {plant.category}
          </span>
        </div>

        {(plant.description || plant.accessNotes) && (
          <div className="mb-6 space-y-2">
            {plant.description && <p className="text-foreground leading-relaxed">{plant.description}</p>}
            {plant.accessNotes && (
              <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" /> {plant.accessNotes}
              </p>
            )}
          </div>
        )}

        {canEdit && (
          <EditPlantDetails
            plantId={plant.id}
            nickname={plant.name === plant.speciesName ? "" : plant.name}
            description={plant.description ?? ""}
            accessNotes={plant.accessNotes ?? ""}
          />
        )}

        <CareActions plantId={plant.id} status={plant.status} user={user} />

        <ActivityFeed logs={observations} />

        <p className="text-xs text-muted-foreground font-mono mt-8 text-center">
          📍 {plant.lat.toFixed(5)}, {plant.lng.toFixed(5)}
        </p>
      </div>
    </main>
  );
}
