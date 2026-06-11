import { auth } from "@/auth";
import { getGardenerProfile } from "@/lib/social-data";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Map as MapIcon, MapPin, CalendarDays, Newspaper } from "lucide-react";
import { BADGES } from "@/lib/badges";
import { STATUS_BADGE_CLASSES } from "@/lib/plant-status";
import FeedCard from "@/components/feed-card";
import { FollowButton } from "@/components/social-buttons";
import ProfileEditForm from "@/components/profile-edit-form";

async function viewerIdFromSession() {
  const session = await auth();
  const id = session?.user?.id ? parseInt(session.user.id, 10) : NaN;
  return Number.isFinite(id) ? id : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const profile = await getGardenerProfile(parseInt(id, 10), null);
  if (!profile) return { title: "Gardener not found · Global Garden" };
  return {
    title: `${profile.displayName} · Global Garden`,
    description:
      profile.bio ??
      `${profile.displayName} tends ${profile.plants.length} public plants on Global Garden. Follow their garden!`,
    alternates: { canonical: `/gardeners/${profile.id}` },
  };
}

function PlantGrid({ title, items }: { title: string; items: { id: number; name: string; emoji: string; status: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="font-heading text-lg font-bold text-foreground mb-3">
        {title} <span className="text-sm font-sans font-normal text-muted-foreground">({items.length})</span>
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((plant) => (
          <Link
            key={plant.id}
            href={`/plants/${plant.id}`}
            className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition flex flex-col gap-2"
          >
            <span className="text-3xl">{plant.emoji}</span>
            <span className="font-medium text-sm text-foreground leading-tight">{plant.name}</span>
            <span
              className={`self-start px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white ${STATUS_BADGE_CLASSES[plant.status] ?? "bg-primary/80"}`}
            >
              {plant.status.replace(/_/g, " ")}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function GardenerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gardenerId = parseInt(id, 10);
  if (!Number.isFinite(gardenerId)) notFound();

  const viewerId = await viewerIdFromSession();
  const profile = await getGardenerProfile(gardenerId, viewerId);
  if (!profile) notFound();

  const isOwnProfile = viewerId === profile.id;
  const joined = new Date(profile.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const statCards = [
    { label: "Plants", value: profile.stats.plantsAdded, emoji: "🌱" },
    { label: "Care actions", value: profile.stats.careActions, emoji: "💧" },
    { label: "Harvests", value: profile.stats.harvestsLogged, emoji: "🧺" },
    { label: "Photos", value: profile.stats.photosContributed, emoji: "📷" },
  ];

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-brand-primary-light">
        <span className="absolute -right-6 -top-10 text-[12rem] leading-none opacity-15 select-none">
          {profile.avatar || "🧑‍🌾"}
        </span>
        <div className="relative z-10 max-w-3xl mx-auto p-6 md:p-10">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              className="flex items-center gap-2 bg-black/30 text-white px-4 py-2 rounded-full hover:bg-black/50 backdrop-blur-md text-sm font-medium"
            >
              <MapIcon className="w-4 h-4" /> Map
            </Link>
            <Link
              href="/feed"
              className="flex items-center gap-2 bg-black/30 text-white px-4 py-2 rounded-full hover:bg-black/50 backdrop-blur-md text-sm font-medium"
            >
              <Newspaper className="w-4 h-4" /> Feed
            </Link>
          </div>

          <div className="flex items-start gap-4 md:gap-6">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/15 border-2 border-white/40 backdrop-blur-md flex items-center justify-center text-4xl md:text-5xl shrink-0">
              {profile.avatar || profile.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="text-white flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-heading font-bold">{profile.displayName}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/80 mt-1">
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {profile.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" /> Joined {joined}
                </span>
              </div>
              {profile.bio && <p className="text-sm md:text-base text-white/90 mt-3 leading-relaxed">{profile.bio}</p>}

              <div className="flex flex-wrap items-center gap-4 mt-4">
                <span className="text-sm">
                  <strong className="font-bold">{profile.followerCount}</strong>{" "}
                  <span className="text-white/75">followers</span>
                </span>
                <span className="text-sm">
                  <strong className="font-bold">{profile.followingCount}</strong>{" "}
                  <span className="text-white/75">following</span>
                </span>
                {isOwnProfile ? (
                  <ProfileEditForm displayName={profile.displayName} bio={profile.bio} location={profile.location} />
                ) : (
                  <FollowButton targetId={profile.id} initialFollowing={profile.isFollowing} signedIn={viewerId !== null} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-5 md:p-10 animate-[content-rise_0.5s_cubic-bezier(0.32,0.72,0,1)]">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 md:gap-3 mb-6">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-secondary/50 rounded-xl p-3 text-center border border-border/50">
              <p className="text-lg md:text-2xl font-mono font-bold text-foreground">
                {stat.emoji} {stat.value}
              </p>
              <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Badges */}
        {profile.badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {profile.badges.map((badge) => {
              const def = BADGES[badge];
              return (
                <span
                  key={badge}
                  className="flex items-center gap-1.5 bg-brand-accent-sun/15 text-foreground border border-brand-accent-sun/40 px-3 py-1.5 rounded-full text-sm font-medium"
                >
                  {def ? `${def.emoji} ${def.label}` : badge}
                </span>
              );
            })}
          </div>
        )}

        <PlantGrid title="Garden" items={profile.plants} />
        <PlantGrid title="Adopted plants" items={profile.adoptedPlants} />

        {/* Activity */}
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground mb-3">Recent activity</h2>
          {profile.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground border border-dashed border-border rounded-2xl p-6 text-center">
              No activity yet.
            </p>
          ) : (
            <div className="space-y-3">
              {profile.recentActivity.map((entry) => (
                <FeedCard key={entry.id} entry={entry} hideUser />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
