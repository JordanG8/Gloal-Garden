import Link from "next/link";
import type { Metadata } from "next";
import { Map as MapIcon, Crown, Trophy, Zap } from "lucide-react";
import { getLeaderboard } from "@/lib/profile-data";
import { trustLevelFor, TRUST_LEVELS } from "@/lib/karma";
import { TrustLevelIcon } from "@/lib/plant-icons";

// Live standings — always rendered fresh, never baked at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard · Global Garden",
  description: "The neighbors growing the most real food — karma earned by watering, harvesting, and rescuing public plants.",
};

const PODIUM_CLASSES: Record<number, string> = {
  0: "bg-amber-100 text-amber-700 border-amber-200",
  1: "bg-stone-100 text-stone-500 border-stone-200",
  2: "bg-orange-100 text-orange-700 border-orange-200",
};

export default async function LeaderboardPage() {
  const rows = await getLeaderboard();
  const elderMin = TRUST_LEVELS[TRUST_LEVELS.length - 1].minKarma;

  return (
    <main className="min-h-screen bg-background">
      <div className="relative flex items-end overflow-hidden bg-primary">
        <Trophy
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
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary-foreground/70">
            Community standings
          </p>
          <h1 className="text-4xl md:text-5xl font-heading font-medium tracking-tight">Leaderboard</h1>
          <p className="text-sm md:text-base text-primary-foreground/75 mt-4 leading-relaxed max-w-md">
            Karma only comes from real care — watering thirsty plants, verified harvests, and rescues.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 md:px-8 md:py-16">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-3xl px-6 py-12 text-center leading-relaxed">
            No gardeners yet — the leaderboard sprouts once people start caring for plants.
          </p>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center gap-4 px-5 pb-2 text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.15em]">
              <span className="w-9">Rank</span>
              <span className="flex-1">Gardener</span>
              <span className="w-16 text-right">7 days</span>
              <span className="w-16 text-right">All time</span>
            </div>
            {rows.map((row, i) => {
              const level = trustLevelFor(row.karma);
              const isElder = row.karma >= elderMin;
              return (
                <Link
                  key={row.id}
                  href={`/users/${row.id}`}
                  className={`flex items-center gap-4 rounded-2xl border px-5 py-4 transition hover:border-primary/40 ${
                    i === 0 ? "bg-primary/5 border-primary/30" : "bg-card border-border"
                  }`}
                >
                  <span
                    className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full border font-mono text-sm font-bold ${
                      PODIUM_CLASSES[i] ?? "border-transparent text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-medium text-foreground truncate flex items-center gap-1.5">
                      {row.displayName}
                      {isElder && <Crown className="w-4 h-4 text-amber-500" strokeWidth={1.75} />}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <TrustLevelIcon level={level.level} className="w-3.5 h-3.5 text-primary/70" strokeWidth={1.75} />
                      {level.name} · {row.badges.length} badge{row.badges.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="w-16 text-right font-mono text-sm text-muted-foreground">
                    +{row.karma7d}
                  </span>
                  <span className="w-16 text-right font-mono text-sm font-bold text-primary flex items-center justify-end gap-1">
                    <Zap className="w-3 h-3" strokeWidth={2} />
                    {row.karma}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center mt-12 leading-relaxed">
          The 7-day column resets the race every week — new gardeners can top it too.
        </p>
      </div>
    </main>
  );
}
