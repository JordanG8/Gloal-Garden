import { auth } from "@/auth";
import { getCommunityFeed, getTopGardeners } from "@/lib/social-data";
import Link from "next/link";
import type { Metadata } from "next";
import { Map as MapIcon, Sprout } from "lucide-react";
import FeedCard from "@/components/feed-card";

export const metadata: Metadata = {
  title: "Community Feed · Global Garden",
  description: "What the neighborhood's gardeners have been up to — waterings, harvests, photos, and rescues.",
};

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const [session, { filter }] = await Promise.all([auth(), searchParams]);
  const viewerId = session?.user?.id ? parseInt(session.user.id, 10) : null;
  const followingOnly = filter === "following" && viewerId !== null;

  const [entries, topGardeners] = await Promise.all([
    getCommunityFeed(followingOnly ? { followerId: viewerId! } : undefined),
    getTopGardeners(),
  ]);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary via-primary/90 to-brand-primary-light">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-6 md:py-8">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/"
              className="flex items-center gap-2 bg-black/30 text-white px-4 py-2 rounded-full hover:bg-black/50 backdrop-blur-md text-sm font-medium"
            >
              <MapIcon className="w-4 h-4" /> Map
            </Link>
            {viewerId !== null && (
              <Link
                href={`/gardeners/${viewerId}`}
                className="flex items-center gap-2 bg-black/30 text-white px-4 py-2 rounded-full hover:bg-black/50 backdrop-blur-md text-sm font-medium"
              >
                My profile
              </Link>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-white">Community Feed</h1>
          <p className="text-white/80 text-sm md:text-base mt-1">
            Waterings, harvests, and rescues from gardeners around the neighborhood.
          </p>

          {/* Tabs */}
          <div className="flex gap-2 mt-5">
            <Link
              href="/feed"
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                !followingOnly ? "bg-white text-primary" : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              Everyone
            </Link>
            <Link
              href={viewerId !== null ? "/feed?filter=following" : "/login"}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                followingOnly ? "bg-white text-primary" : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              Following
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-6 md:py-8 grid md:grid-cols-[1fr_280px] gap-8 animate-[content-rise_0.5s_cubic-bezier(0.32,0.72,0,1)]">
        {/* Feed */}
        <div className="space-y-3 min-w-0">
          {entries.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
              <Sprout className="w-8 h-8 mx-auto mb-3 opacity-50" />
              {followingOnly ? (
                <p className="text-sm">
                  Nothing here yet — follow some gardeners from the{" "}
                  <Link href="/feed" className="text-primary hover:underline">
                    community feed
                  </Link>
                  !
                </p>
              ) : (
                <p className="text-sm">No activity yet. Be the first to log something!</p>
              )}
            </div>
          ) : (
            entries.map((entry) => <FeedCard key={entry.id} entry={entry} />)
          )}
        </div>

        {/* Top gardeners */}
        <aside className="md:sticky md:top-6 self-start">
          <h2 className="font-heading text-lg font-bold text-foreground mb-3">Top gardeners</h2>
          <div className="space-y-2">
            {topGardeners.map((gardener, i) => (
              <Link
                key={gardener.id}
                href={`/gardeners/${gardener.id}`}
                className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3 shadow-sm hover:shadow-md transition"
              >
                <span className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-lg shrink-0">
                  {gardener.avatar || gardener.displayName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-foreground truncate">
                    {i < 3 ? ["🥇", "🥈", "🥉"][i] + " " : ""}
                    {gardener.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{gardener.bio || `${gardener.total} contributions`}</p>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
