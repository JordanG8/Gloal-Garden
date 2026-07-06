import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Map as MapIcon, Trophy, MapPin } from "lucide-react";
import { getUserProfile } from "@/lib/profile-data";
import { BADGES, trustLevelFor, nextTrustLevel } from "@/lib/karma";
import { timeAgo } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await getUserProfile(parseInt(id, 10));
  if (!profile) return { title: "Gardener not found · Global Garden" };
  const level = trustLevelFor(profile.karma);
  return {
    title: `${profile.displayName} · Global Garden`,
    description: `${level.name} with ${profile.karma} karma — ${profile.stats.plantsFounded} plants planted, ${profile.stats.harvests} harvests logged on Global Garden.`,
  };
}

const EVENT_LABELS: Record<string, string> = {
  water_due: "watered a thirsty plant",
  water_early: "watered (not due yet)",
  photo: "posted an update",
  harvest: "logged a harvest",
  report: "reported an issue",
  report_confirmed: "report confirmed by a neighbor",
  resolve: "resolved an issue",
  plant_new: "planted something new",
  plant_established: "a plant they founded got established",
  plant_first_harvest: "a plant they founded fed someone",
  adopt: "adopted a plant",
  rescue_bonus: "rescued a plant in trouble",
  moderation_adjust: "moderation adjustment",
};

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = parseInt(id, 10);
  if (!Number.isFinite(userId)) notFound();

  const profile = await getUserProfile(userId);
  if (!profile) notFound();

  const level = trustLevelFor(profile.karma);
  const next = nextTrustLevel(profile.karma);
  const progress = next
    ? Math.min(100, Math.round(((profile.karma - level.minKarma) / (next.minKarma - level.minKarma)) * 100))
    : 100;

  const heroStats = [
    { label: "Verified harvests", value: profile.stats.verifiedHarvests, emoji: "🍅" },
    { label: "Plants rescued", value: profile.stats.rescues, emoji: "🚑" },
    { label: "Waterings", value: profile.stats.waterings, emoji: "💧" },
    { label: "Plants planted", value: profile.stats.plantsFounded, emoji: "🌱" },
    { label: "Photo updates", value: profile.stats.photos, emoji: "📸" },
    { label: "All harvests", value: profile.stats.harvests, emoji: "🧺" },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="relative flex items-end overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-brand-primary-light">
        <span className="absolute -right-4 -top-10 text-[13rem] leading-none opacity-20 select-none">
          {level.emoji}
        </span>
        <Link
          href="/"
          className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/30 text-white px-4 py-2 rounded-full hover:bg-black/50 backdrop-blur-md text-sm font-medium"
        >
          <MapIcon className="w-4 h-4" /> Back to map
        </Link>

        <div className="relative z-10 p-6 md:p-10 pt-20 md:pt-24 text-white w-full max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 backdrop-blur-md bg-white/20 rounded text-xs font-bold uppercase tracking-wider">
              {level.emoji} {level.name}
            </span>
            <span className="font-mono text-sm font-bold">⚡ {profile.karma} karma</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold">{profile.displayName}</h1>
          {profile.bio && <p className="text-sm md:text-base text-white/80 mt-1">{profile.bio}</p>}
          {profile.location && (
            <p className="text-sm text-white/70 mt-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {profile.location}
            </p>
          )}
          {next && (
            <div className="mt-4 max-w-xs">
              <p className="text-xs text-white/80 mb-1 font-mono">
                {next.minKarma - profile.karma} karma to {next.emoji} {next.name}
              </p>
              <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-white/90" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-5 md:p-10">
        {/* Contribution stats — computed from real, verifiable history */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {heroStats.map((stat) => (
            <div key={stat.label} className="bg-secondary/50 rounded-xl p-3 md:p-4 text-center border border-border/50">
              <p className="font-mono text-xl md:text-2xl font-bold text-foreground">
                {stat.emoji} {stat.value}
              </p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Badges */}
        <h2 className="font-heading text-lg font-bold text-foreground mb-3">Badges</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          {BADGES.map((badge) => {
            const earned = profile.badges.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`rounded-2xl border p-3 ${
                  earned ? "bg-card border-primary/30 shadow-sm" : "bg-secondary/30 border-border/50 opacity-45"
                }`}
                title={badge.description}
              >
                <p className="text-xl">{badge.emoji}</p>
                <p className="text-sm font-bold text-foreground mt-1">{badge.name}</p>
                <p className="text-xs text-muted-foreground leading-snug">{badge.description}</p>
              </div>
            );
          })}
        </div>

        {/* Stewardships */}
        <h2 className="font-heading text-lg font-bold text-foreground mb-3">Stewarding</h2>
        {profile.stewardships.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-2xl p-5 text-center mb-8">
            Not stewarding any plants yet — find one on the map that needs a hand. 🤲
          </p>
        ) : (
          <div className="space-y-2 mb-8">
            {profile.stewardships.map((stewardship) => (
              <Link
                key={stewardship.plantId}
                href={`/plants/${stewardship.plantId}`}
                className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition hover:border-primary/40 ${
                  stewardship.active ? "bg-card border-border" : "bg-secondary/30 border-border/50 opacity-60"
                }`}
              >
                <p className="text-sm font-medium text-foreground">
                  {stewardship.emoji} {stewardship.plantName}
                </p>
                <span className="text-xs text-muted-foreground">
                  {stewardship.active ? "active" : "lapsed 💤"}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Recent karma activity */}
        <h2 className="font-heading text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" /> Recent karma
        </h2>
        {profile.recentEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-2xl p-5 text-center">
            No karma activity yet.
          </p>
        ) : (
          <div className="space-y-1.5">
            {profile.recentEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between gap-3 text-sm px-4 py-2.5 rounded-xl bg-secondary/40 border border-border/50"
              >
                <p className="text-foreground min-w-0 truncate">
                  {EVENT_LABELS[event.kind] ?? event.kind}
                  {event.plantName && event.plantId && (
                    <>
                      {" · "}
                      <Link href={`/plants/${event.plantId}`} className="text-primary hover:underline">
                        {event.plantName}
                      </Link>
                    </>
                  )}
                </p>
                <p className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-mono font-bold ${
                      event.points > 0 ? "text-primary" : event.points < 0 ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {event.points > 0 ? `+${event.points}` : event.points}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(event.createdAt)}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
