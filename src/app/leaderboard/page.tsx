import Link from "next/link";
import type { Metadata } from "next";
import { Map as MapIcon, Crown } from "lucide-react";
import { getLeaderboard } from "@/lib/profile-data";
import { trustLevelFor, TRUST_LEVELS } from "@/lib/karma";

// Live standings — always rendered fresh, never baked at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard · Global Garden",
  description: "The neighbors growing the most real food — karma earned by watering, harvesting, and rescuing public plants.",
};

export default async function LeaderboardPage() {
  const rows = await getLeaderboard();
  const elderMin = TRUST_LEVELS[TRUST_LEVELS.length - 1].minKarma;

  return (
    <main className="min-h-screen bg-background">
      <div className="relative flex items-end overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-brand-primary-light">
        <span className="absolute -right-4 -top-10 text-[13rem] leading-none opacity-20 select-none">🏆</span>
        <Link
          href="/"
          className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/30 text-white px-4 py-2 rounded-full hover:bg-black/50 backdrop-blur-md text-sm font-medium"
        >
          <MapIcon className="w-4 h-4" /> Back to map
        </Link>
        <div className="relative z-10 p-6 md:p-10 pt-20 md:pt-24 text-white w-full max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-heading font-bold">Leaderboard</h1>
          <p className="text-sm md:text-base text-white/80 mt-1">
            Karma only comes from real care — watering thirsty plants, verified harvests, and rescues.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-5 md:p-10">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-2xl p-8 text-center">
            No gardeners yet — the leaderboard sprouts once people start caring for plants.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">
              <span className="w-8">#</span>
              <span className="flex-1">Gardener</span>
              <span className="w-20 text-right">7 days</span>
              <span className="w-20 text-right">All time</span>
            </div>
            {rows.map((row, i) => {
              const level = trustLevelFor(row.karma);
              const isElder = row.karma >= elderMin;
              return (
                <Link
                  key={row.id}
                  href={`/users/${row.id}`}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition hover:border-primary/40 ${
                    i === 0 ? "bg-primary/5 border-primary/30" : "bg-card border-border"
                  }`}
                >
                  <span className="w-8 font-mono font-bold text-muted-foreground">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-medium text-foreground truncate flex items-center gap-1.5">
                      {row.displayName}
                      {isElder && <Crown className="w-4 h-4 text-amber-500" />}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {level.emoji} {level.name} · {row.badges.length} badge{row.badges.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="w-20 text-right font-mono text-sm text-muted-foreground">
                    +{row.karma7d}
                  </span>
                  <span className="w-20 text-right font-mono text-sm font-bold text-primary">
                    ⚡ {row.karma}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center mt-8">
          The 7-day column resets the race every week — new gardeners can top it too.
        </p>
      </div>
    </main>
  );
}
