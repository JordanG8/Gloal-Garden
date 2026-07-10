import { getPlantDetail } from "@/lib/data";
import { getSessionUser } from "@/lib/auth-helpers";
import { canEditPlant } from "@/lib/karma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Map as MapIcon, MapPin, Droplet, CalendarClock, Sun, Camera } from "lucide-react";
import type { Metadata } from "next";
import { STATUS_BADGE_CLASSES } from "@/lib/plant-status";
import { daysAgoLabel } from "@/lib/format";
import { CategoryIcon } from "@/lib/plant-icons";
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
    title: `${plant.name} · Global Garden`,
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
      <div className="relative h-72 md:h-96 flex items-end overflow-hidden bg-primary">
        <CategoryIcon
          category={plant.category}
          className="absolute -right-8 -top-10 w-72 h-72 md:w-[26rem] md:h-[26rem] text-primary-foreground/10 select-none"
          strokeWidth={1}
        />

        <Link
          href={`/?plant=${plant.id}`}
          className="absolute top-5 left-5 md:top-8 md:left-8 z-20 flex items-center gap-2 bg-black/25 text-white px-5 py-2.5 rounded-full hover:bg-black/40 backdrop-blur-md text-sm font-medium transition"
        >
          <MapIcon className="w-4 h-4" strokeWidth={1.75} /> Back to map
        </Link>

        <div className="relative z-10 w-full max-w-2xl mx-auto px-6 pb-10 md:px-8 md:pb-14 text-primary-foreground">
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.15em] text-white ${STATUS_BADGE_CLASSES[plant.status] ?? "bg-primary/80"}`}
            >
              {plant.status.replace(/_/g, " ")}
            </span>
            {plant.upForAdoption && (
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.15em] bg-amber-500/90 text-white">
                Needs a steward
              </span>
            )}
            {!verified && (
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.15em] bg-black/25 text-white flex items-center gap-1.5">
                <Camera className="w-3 h-3" strokeWidth={2} /> Needs photo verification
              </span>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-medium tracking-tight">{plant.name}</h1>
          <p className="text-sm md:text-base text-primary-foreground/70 italic mt-2">
            {plant.speciesName} · {plant.scientificName}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 md:px-8 md:py-16 animate-[content-rise_0.5s_cubic-bezier(0.32,0.72,0,1)]">
        {/* Vitals */}
        <div className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card mb-10">
          <div className="px-2 py-5 md:py-6 text-center">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.15em] mb-2">Planted</p>
            <p className="font-mono text-sm md:text-base font-bold text-foreground">{daysAgoLabel(plant.plantedAt)}</p>
          </div>
          <div className="px-2 py-5 md:py-6 text-center">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.15em] mb-2">Watered</p>
            <p className="font-mono text-sm md:text-base font-bold text-foreground">{daysAgoLabel(plant.lastWateredAt)}</p>
          </div>
          <div className="px-2 py-5 md:py-6 text-center">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.15em] mb-2">Planted by</p>
            <Link
              href={`/users/${plant.founderId}`}
              className="font-mono text-sm md:text-base font-bold text-primary truncate px-1 block hover:underline"
            >
              {plant.plantedByName}
            </Link>
          </div>
        </div>

        {/* Species care facts */}
        <div className="flex flex-wrap gap-2.5 mb-10 text-sm">
          {plant.wateringFrequencyDays && (
            <span className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-muted-foreground">
              <Droplet className="w-3.5 h-3.5 text-blue-500" strokeWidth={1.75} /> Water every {plant.wateringFrequencyDays}d
            </span>
          )}
          {plant.daysToHarvest && (
            <span className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-muted-foreground">
              <CalendarClock className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} /> ~{plant.daysToHarvest}d to harvest
            </span>
          )}
          <span className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-muted-foreground capitalize">
            <Sun className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.75} /> {plant.category}
          </span>
        </div>

        {(plant.description || plant.accessNotes) && (
          <div className="mb-10 space-y-3">
            {plant.description && <p className="text-foreground leading-relaxed">{plant.description}</p>}
            {plant.accessNotes && (
              <p className="text-sm text-muted-foreground flex items-start gap-2 leading-relaxed">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.75} /> {plant.accessNotes}
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

        <StewardSection
          plantId={plant.id}
          founderId={plant.founderId}
          founderName={plant.plantedByName}
          upForAdoption={plant.upForAdoption}
          stewardCount={stewards.length}
          stewards={stewards}
          user={user}
        />

        <CareActions plantId={plant.id} status={plant.status} user={user} />

        <ActivityFeed logs={observations} />

        <p className="mt-16 flex items-center justify-center gap-1.5 text-center font-mono text-xs text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" strokeWidth={1.75} />
          {plant.lat.toFixed(5)}, {plant.lng.toFixed(5)}
        </p>
      </div>
    </main>
  );
}
