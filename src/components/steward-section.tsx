"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HeartHandshake, Moon, Sprout } from "lucide-react";
import type { SessionUser, StewardEntry } from "@/lib/types";
import { adoptPlant, abandonPlant } from "@/lib/adoption-actions";

export default function StewardSection({
  plantId,
  founderId,
  founderName,
  upForAdoption,
  stewardCount,
  stewards,
  viewerIsSteward,
  user,
}: {
  plantId: number;
  founderId: number;
  founderName: string;
  upForAdoption: boolean;
  stewardCount: number;
  /** Full list when available (plant page); panel falls back to the count. */
  stewards?: StewardEntry[];
  /** Set when the caller already knows the viewer's stewardship (map panel). */
  viewerIsSteward?: boolean;
  user: SessionUser | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  const isFounder = user?.id === founderId;
  const isSteward =
    !!user && (viewerIsSteward ?? stewards?.some((s) => s.id === user.id) ?? false);
  const showAdopt = !isFounder && !isSteward;

  function runAdopt() {
    if (!user) {
      router.push("/login");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await adoptPlant(plantId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.pointsAwarded) setNotice(`+${result.pointsAwarded} karma — welcome, steward!`);
      router.refresh();
    });
  }

  function runAbandon() {
    setError("");
    startTransition(async () => {
      const result = await abandonPlant(plantId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice("");
      router.refresh();
    });
  }

  return (
    <div className="mb-5">
      {upForAdoption && (
        <div className="mb-3 flex items-center gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-4 py-3">
          <HeartHandshake className="w-5 h-5 shrink-0" />
          <p className="text-sm">
            <span className="font-bold">This plant needs a steward.</span> Nobody has checked on it
            in a while — adopt it and keep the food coming.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 bg-secondary/50 border border-border/50 rounded-2xl px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">
            Stewardship
          </p>
          <p className="text-sm text-foreground truncate">
            Planted by{" "}
            <Link href={`/users/${founderId}`} className="font-bold text-primary hover:underline">
              {founderName}
            </Link>
            {stewardCount > 0 && (
              <span className="text-muted-foreground">
                {" "}· {stewardCount} steward{stewardCount === 1 ? "" : "s"}
              </span>
            )}
          </p>
        </div>

        {showAdopt ? (
          <button
            disabled={pending}
            onClick={runAdopt}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60"
          >
            <Sprout className="w-4 h-4" /> Adopt
          </button>
        ) : isSteward ? (
          <button
            disabled={pending}
            onClick={runAbandon}
            className="shrink-0 px-4 py-2 rounded-full bg-secondary text-muted-foreground text-sm font-medium border border-border hover:text-destructive hover:border-destructive/40 transition disabled:opacity-60"
          >
            Stop stewarding
          </button>
        ) : null}
      </div>

      {stewards && stewards.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground py-1">Kept alive by</span>
          {stewards.map((steward) => (
            <Link
              key={steward.id}
              href={`/users/${steward.id}`}
              title={steward.active ? "Active steward" : "Inactive — stewardship has lapsed"}
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition ${
                steward.active
                  ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                  : "bg-secondary text-muted-foreground border-border opacity-60 hover:opacity-100"
              }`}
            >
              {steward.name}
              {!steward.active && <Moon className="w-3 h-3 opacity-70" strokeWidth={1.75} />}
            </Link>
          ))}
        </div>
      )}

      {notice && (
        <p className="mt-2 text-sm text-primary bg-primary/10 border border-primary/20 rounded-xl px-4 py-2">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
