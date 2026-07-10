import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Map as MapIcon,
  MapPin,
  Zap,
  Apple,
  Siren,
  Droplet,
  Sprout,
  Camera,
  ShoppingBasket,
  Moon,
  type LucideIcon,
} from "lucide-react";
import { getUserProfile } from "@/lib/profile-data";
import { BADGES, trustLevelFor, nextTrustLevel } from "@/lib/karma";
import { BadgeIcon, CategoryIcon, TrustLevelIcon } from "@/lib/plant-icons";
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

  const heroStats: { label: string; value: number; icon: LucideIcon }[] = [
    { label: "Verified harvests", value: profile.stats.verifiedHarvests, icon: Apple },
    { label: "Plants rescued", value: profile.stats.rescues, icon: Siren },
    { label: "Waterings", value: profile.stats.waterings, icon: Droplet },
    { label: "Plants planted", value: profile.stats.plantsFounded, icon: Sprout },
    { label: "Photo updates", value: profile.stats.photos, icon: Camera },
    { label: "All harvests", value: profile.stats.harvests, icon: ShoppingBasket },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="relative flex items-end overflow-hidden bg-primary">
        <TrustLevelIcon
          level={level.level}
          className="absolute -right-10 -top-12 w-80 h-80 text-primary-foreground/10 select-none"
          strokeWidth={1}
        />
        <Link
          href="/"
          className="absolute top-5 left-5 md:top-8 md:left-8 z-20 flex items-center gap-2 bg-black/25 text-white px-5 py-2.5 rounded-full hover:bg-black/40 backdrop-blur-md text-sm font-medium transition"
        >
          <MapIcon className="w-4 h-4" strokeWidth={1.75} /> Back to map
        </Link>

        <div className="relative z-10 w-full max-w-2xl mx-auto px-6 pb-12 pt-28 md:px-8 md:pb-16 md:pt-32 text-primary-foreground">
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-semibold uppercase tracking-[0.15em]">
              <TrustLevelIcon level={level.level} className="w-3.5 h-3.5" strokeWidth={2} /> {level.name}
            </span>
            <span className="flex items-center gap-1 font-mono text-sm font-bold">
              <Zap className="w-3.5 h-3.5" strokeWidth={1.75} /> {profile.karma} karma
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-medium tracking-tight">{profile.displayName}</h1>
          {profile.bio && <p className="text-sm md:text-base text-primary-foreground/75 mt-3 leading-relaxed max-w-lg">{profile.bio}</p>}
          {profile.location && (
            <p className="text-sm text-primary-foreground/60 mt-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" strokeWidth={1.75} /> {profile.location}
            </p>
          )}
          {next && (
            <div className="mt-8 max-w-xs">
              <p className="text-xs text-primary-foreground/75 mb-2 font-mono flex items-center gap-1.5">
                {next.minKarma - profile.karma} karma to
                <TrustLevelIcon level={next.level} className="w-3.5 h-3.5" strokeWidth={2} />
                {next.name}
              </p>
              <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-white/90" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 md:px-8 md:py-16">
        {/* Contribution stats — computed from real, verifiable history */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-14">
          {heroStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border bg-card px-4 py-6 text-center">
              <stat.icon className="w-4.5 h-4.5 mx-auto mb-3 text-primary" strokeWidth={1.75} />
              <p className="font-mono text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.15em] mt-1.5">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Badges */}
        <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Badges
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-14">
          {BADGES.map((badge) => {
            const earned = profile.badges.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`rounded-2xl border p-5 ${
                  earned ? "bg-card border-primary/30 shadow-sm" : "bg-secondary/30 border-border/50 opacity-45"
                }`}
                title={badge.description}
              >
                <BadgeIcon badgeId={badge.id} className={`w-5 h-5 ${earned ? "text-primary" : "text-muted-foreground"}`} strokeWidth={1.75} />
                <p className="text-sm font-bold text-foreground mt-3">{badge.name}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">{badge.description}</p>
              </div>
            );
          })}
        </div>

        {/* Stewardships */}
        <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Stewarding
        </h2>
        {profile.stewardships.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-3xl px-6 py-10 text-center leading-relaxed mb-14">
            Not stewarding any plants yet — find one on the map that needs a hand.
          </p>
        ) : (
          <div className="space-y-2.5 mb-14">
            {profile.stewardships.map((stewardship) => {
              return (
                <Link
                  key={stewardship.plantId}
                  href={`/plants/${stewardship.plantId}`}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 transition hover:border-primary/40 ${
                    stewardship.active ? "bg-card border-border" : "bg-secondary/30 border-border/50 opacity-60"
                  }`}
                >
                  <p className="flex items-center gap-3 text-sm font-medium text-foreground">
                    <CategoryIcon category={stewardship.category} className="w-4 h-4 text-primary" strokeWidth={1.75} />
                    {stewardship.plantName}
                  </p>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {stewardship.active ? "active" : (
                      <>
                        lapsed <Moon className="w-3 h-3" strokeWidth={1.75} />
                      </>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Recent karma activity */}
        <h2 className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Zap className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} /> Recent karma
        </h2>
        {profile.recentEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-3xl px-6 py-10 text-center leading-relaxed">
            No karma activity yet.
          </p>
        ) : (
          <div className="space-y-2">
            {profile.recentEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between gap-3 text-sm px-5 py-3.5 rounded-2xl bg-card border border-border"
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
                <p className="flex items-center gap-2.5 shrink-0">
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
