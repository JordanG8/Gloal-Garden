import { auth } from "@/auth";
import { getPlantDetail } from "@/lib/data";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Map as MapIcon, MapPin, Droplet, CalendarClock, Sun } from "lucide-react";
import type { Metadata } from "next";
import type { SessionUser } from "@/lib/types";
import { daysAgoLabel } from "@/lib/format";
import CareActions from "@/components/plant-care";
import ActivityFeed from "@/components/activity-feed";
import PlantHero from "@/components/plant-hero";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const detail = await getPlantDetail(parseInt(id, 10));
  if (!detail) return { title: "Plant not found · Global Garden" };

  const { plant } = detail;
  const title = `${plant.emoji} ${plant.name} · Global Garden`;
  const description = `${plant.speciesName} (${plant.scientificName}) growing in public — planted by ${plant.plantedByName}, currently ${plant.status.replace(/_/g, " ")}. Help keep it alive on Global Garden.`;

  return {
    title,
    description,
    alternates: { canonical: `/plants/${plant.id}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/plants/${plant.id}`,
      siteName: "Global Garden",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PlantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plantId = parseInt(id, 10);
  if (!Number.isFinite(plantId)) notFound();

  const [session, detail] = await Promise.all([auth(), getPlantDetail(plantId)]);
  if (!detail) notFound();

  const { plant, observations } = detail;

  let user: SessionUser | null = null;
  if (session?.user?.id) {
    const uid = parseInt(session.user.id, 10);
    if (Number.isFinite(uid)) user = { id: uid, name: session.user.name ?? "Gardener" };
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: plant.name,
    description: `${plant.speciesName} (${plant.scientificName}), planted by ${plant.plantedByName}.${plant.description ? ` ${plant.description}` : ""}`,
    geo: { "@type": "GeoCoordinates", latitude: plant.lat, longitude: plant.lng },
    keywords: [plant.speciesName, plant.scientificName, plant.category, "community garden", "urban gardening"],
  };

  return (
    <main className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PlantHero plant={plant}>
        <Link
          href={`/?plant=${plant.id}`}
          className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/30 text-white px-4 py-2 rounded-full hover:bg-black/50 backdrop-blur-md text-sm font-medium"
        >
          <MapIcon className="w-4 h-4" /> Back to map
        </Link>
      </PlantHero>

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
            <p className="font-mono text-sm md:text-base font-bold text-foreground truncate px-1">{plant.plantedByName}</p>
          </div>
        </div>

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

        <CareActions plantId={plant.id} status={plant.status} user={user} />

        <ActivityFeed logs={observations} />

        <p className="text-xs text-muted-foreground font-mono mt-8 text-center">
          📍 {plant.lat.toFixed(5)}, {plant.lng.toFixed(5)}
        </p>
      </div>
    </main>
  );
}
