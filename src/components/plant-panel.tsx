"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X, Droplet, Camera, CheckCircle2, AlertTriangle, Clock, Sprout, HeartPulse, MapPin,
} from "lucide-react";
import type { ObservationEntry, PlantSummary, SessionUser } from "@/lib/types";
import { logCareAction } from "@/lib/plant-actions";

type ComposerType = "photo" | "harvest" | "report" | null;

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function daysAgoLabel(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  return days === 0 ? "today" : `${days}d ago`;
}

const LOG_ICONS: Record<string, React.ReactNode> = {
  water: <Droplet className="w-4 h-4 text-blue-500" />,
  photo: <Camera className="w-4 h-4 text-primary" />,
  harvest: <CheckCircle2 className="w-4 h-4 text-destructive" />,
  alert: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  resolve: <HeartPulse className="w-4 h-4 text-primary" />,
};

const LOG_LABELS: Record<string, string> = {
  water: "watered",
  photo: "added a photo",
  harvest: "harvested",
  alert: "reported an issue",
  resolve: "marked healthy",
};

const STATUS_BADGES: Record<string, string> = {
  growing: "bg-primary/80",
  needs_water: "bg-blue-500/80",
  ready_to_harvest: "bg-destructive/80",
  needs_attention: "bg-orange-500/80",
  diseased: "bg-orange-600/80",
  dormant: "bg-stone-500/80",
};

export default function PlantPanel({
  plant,
  user,
  onClose,
}: {
  plant: PlantSummary | null;
  user: SessionUser | null;
  onClose: () => void;
}) {
  return (
    <div
      className={`absolute md:relative z-20 bottom-0 left-0 w-full md:w-[400px] h-[75vh] md:h-full bg-background border-t md:border-t-0 md:border-l border-border shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col ${
        plant ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full md:w-0 md:border-l-0 overflow-hidden"
      }`}
    >
      {/* Keyed by plant id so composer/error/feed state resets when switching plants. */}
      {plant && <PanelContent key={plant.id} plant={plant} user={user} onClose={onClose} />}
    </div>
  );
}

function PanelContent({
  plant,
  user,
  onClose,
}: {
  plant: PlantSummary;
  user: SessionUser | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [logs, setLogs] = useState<ObservationEntry[] | null>(null);
  const [composer, setComposer] = useState<ComposerType>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/plants/${plant.id}/activity`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (!cancelled) setLogs(data.observations);
      })
      .catch(() => {
        if (!cancelled) setLogs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [plant.id]);

  function runAction(input: Parameters<typeof logCareAction>[0]) {
    if (!user) {
      router.push("/login");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await logCareAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setComposer(null);
      router.refresh();
      // Reload the activity feed so the new entry shows immediately.
      const res = await fetch(`/api/plants/${input.plantId}/activity`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.observations);
      }
    });
  }

  function submitComposer(formData: FormData) {
    if (!composer) return;
    runAction({
      plantId: plant.id,
      type: composer,
      caption: String(formData.get("caption") ?? ""),
      photoUrl: String(formData.get("photoUrl") ?? ""),
      harvestQuantity: String(formData.get("harvestQuantity") ?? ""),
      diseaseTag: String(formData.get("diseaseTag") ?? ""),
    });
  }

  const needsResolve = plant.status === "needs_attention" || plant.status === "diseased";

  return (
    <>
      {/* Header */}
          <div className="relative h-44 shrink-0 flex items-end overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-brand-primary-light">
            <span className="absolute -right-4 -top-6 text-[9rem] leading-none opacity-20 select-none">{plant.emoji}</span>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 bg-black/30 text-white p-2 rounded-full hover:bg-black/50 backdrop-blur-md"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative z-10 p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{plant.emoji}</span>
                <span className={`px-2 py-0.5 backdrop-blur-md rounded text-xs font-bold uppercase tracking-wider ${STATUS_BADGES[plant.status] ?? "bg-primary/80"}`}>
                  {plant.status.replace(/_/g, " ")}
                </span>
              </div>
              <h2 className="text-2xl font-heading font-bold">{plant.name}</h2>
              <p className="text-sm text-white/80 italic">{plant.scientificName}</p>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-5 pb-24 md:pb-5">
            {/* Vitals */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-secondary/50 rounded-xl p-3 text-center border border-border/50">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Planted</p>
                <p className="font-mono text-sm font-bold text-foreground">{daysAgoLabel(plant.plantedAt)}</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-3 text-center border border-border/50">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Watered</p>
                <p className="font-mono text-sm font-bold text-foreground">{daysAgoLabel(plant.lastWateredAt)}</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-3 text-center border border-border/50">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Planted by</p>
                <p className="font-mono text-sm font-bold text-foreground truncate px-1">{plant.plantedByName}</p>
              </div>
            </div>

            {(plant.description || plant.accessNotes) && (
              <div className="mb-5 space-y-2">
                {plant.description && <p className="text-sm text-foreground leading-relaxed">{plant.description}</p>}
                {plant.accessNotes && (
                  <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" /> {plant.accessNotes}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                disabled={pending}
                onClick={() => runAction({ plantId: plant.id, type: "water" })}
                className="flex items-center justify-center gap-2 bg-blue-50 text-blue-700 py-3 rounded-xl font-medium hover:bg-blue-100 transition border border-blue-200 disabled:opacity-60"
              >
                <Droplet className="w-4 h-4" /> Water
              </button>
              <button
                disabled={pending}
                onClick={() => setComposer(composer === "photo" ? null : "photo")}
                className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground py-3 rounded-xl font-medium hover:bg-secondary/80 transition border border-border disabled:opacity-60"
              >
                <Camera className="w-4 h-4" /> Photo
              </button>
              <button
                disabled={pending}
                onClick={() => setComposer(composer === "harvest" ? null : "harvest")}
                className="flex items-center justify-center gap-2 bg-destructive/10 text-destructive py-3 rounded-xl font-medium hover:bg-destructive/20 transition border border-destructive/20 disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" /> Harvest
              </button>
              <button
                disabled={pending}
                onClick={() => setComposer(composer === "report" ? null : "report")}
                className="flex items-center justify-center gap-2 bg-orange-50 text-orange-700 py-3 rounded-xl font-medium hover:bg-orange-100 transition border border-orange-200 disabled:opacity-60"
              >
                <AlertTriangle className="w-4 h-4" /> Report
              </button>
            </div>

            {needsResolve && (
              <button
                disabled={pending}
                onClick={() => runAction({ plantId: plant.id, type: "resolve" })}
                className="w-full mb-4 flex items-center justify-center gap-2 bg-primary/10 text-primary py-3 rounded-xl font-medium hover:bg-primary/20 transition border border-primary/20 disabled:opacity-60"
              >
                <HeartPulse className="w-4 h-4" /> Mark Healthy
              </button>
            )}

            {/* Composer */}
            {composer && (
              <form action={submitComposer} className="mb-6 bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm">
                {composer === "photo" && (
                  <input
                    name="photoUrl"
                    type="url"
                    placeholder="Photo URL (https://…)"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                )}
                {composer === "harvest" && (
                  <input
                    name="harvestQuantity"
                    type="text"
                    placeholder="How much did you harvest? e.g. 3 tomatoes"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                )}
                {composer === "report" && (
                  <select
                    name="diseaseTag"
                    defaultValue=""
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  >
                    <option value="">General concern (needs attention)</option>
                    <option value="pests">Pests</option>
                    <option value="fungus">Fungus / mildew</option>
                    <option value="blight">Blight</option>
                    <option value="wilting">Wilting / disease</option>
                  </select>
                )}
                <textarea
                  name="caption"
                  rows={2}
                  placeholder={composer === "report" ? "Describe what you saw…" : "Add a note (optional)…"}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60"
                >
                  {pending ? "Saving…" : `Log ${composer}`}
                </button>
              </form>
            )}

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 mb-4">
                {error}
              </p>
            )}

            {/* Activity feed */}
            <div className="mb-4">
              <h3 className="font-heading text-lg font-bold text-foreground mb-4 flex items-center justify-between">
                Activity Feed
                <span className="text-xs font-sans font-normal text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                  {logs ? `${logs.length} logs` : "loading…"}
                </span>
              </h3>

              {logs === null ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-16 bg-secondary/60 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-2xl">
                  <Sprout className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  No activity yet. Be the first to check on this plant!
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {logs.map((log) => (
                    <div key={log.id} className="relative flex items-start gap-4">
                      <div className="z-10 flex items-center justify-center w-10 h-10 rounded-full bg-background border-2 border-border shadow-sm shrink-0 mt-1">
                        {LOG_ICONS[log.type] ?? <Sprout className="w-4 h-4 text-primary" />}
                      </div>
                      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm w-full">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <p className="font-medium text-sm text-foreground">
                            <span className="font-bold">{log.userName}</span> {LOG_LABELS[log.type] ?? log.type}
                            {log.harvestQuantity ? ` · ${log.harvestQuantity}` : ""}
                            {log.diseaseTag ? ` · ${log.diseaseTag}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                            <Clock className="w-3 h-3" /> {timeAgo(log.createdAt)}
                          </p>
                        </div>
                        {log.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={log.photoUrl}
                            alt={log.caption ?? "Plant photo"}
                            className="w-full h-36 object-cover rounded-xl my-2 border border-border"
                          />
                        )}
                        {log.caption && (
                          <p className="text-sm text-muted-foreground leading-relaxed">&ldquo;{log.caption}&rdquo;</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
    </>
  );
}
