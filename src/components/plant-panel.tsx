"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, MapPin, ChevronUp } from "lucide-react";
import type { ObservationEntry, PlantSummary, SessionUser } from "@/lib/types";
import { STATUS_BADGE_CLASSES } from "@/lib/plant-status";
import { daysAgoLabel } from "@/lib/format";
import CareActions from "./plant-care";
import ActivityFeed from "./activity-feed";
import StewardSection from "./steward-section";

const EXPAND_NAV_DELAY_MS = 380;
const DRAG_OPEN_THRESHOLD_PX = -70;

export default function PlantPanel({
  plant,
  user,
  viewerIsSteward = false,
  onClose,
}: {
  plant: PlantSummary | null;
  user: SessionUser | null;
  viewerIsSteward?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const startY = useRef(0);

  // Prefetch the full page as soon as a plant is selected so the pull-up is instant.
  useEffect(() => {
    if (plant) router.prefetch(`/plants/${plant.id}`);
  }, [plant, router]);

  function openFullPage() {
    if (!plant || expanding) return;
    setExpanding(true);
    setDragY(0);
    setTimeout(() => {
      router.push(`/plants/${plant.id}`);
      // Reset after navigation so the panel is normal when the user comes back.
      setTimeout(() => setExpanding(false), 600);
    }, EXPAND_NAV_DELAY_MS);
  }

  function onPointerDown(e: React.PointerEvent) {
    startY.current = e.clientY;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDragY(Math.min(0, e.clientY - startY.current));
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (dragY < DRAG_OPEN_THRESHOLD_PX) {
      openFullPage();
    } else {
      setDragY(0);
    }
  }

  return (
    <>
      <div
        className={`absolute md:relative z-20 bottom-0 left-0 w-full md:w-[400px] h-[75vh] md:h-full bg-background border-t md:border-t-0 md:border-l border-border shadow-2xl flex flex-col ${
          dragging ? "" : "transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
        } ${
          plant ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full md:w-0 md:border-l-0 overflow-hidden"
        }`}
        style={dragY !== 0 ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        {/* Keyed by plant id so composer/error/feed state resets when switching plants. */}
        {plant && (
          <PanelContent
            key={plant.id}
            plant={plant}
            user={user}
            viewerIsSteward={viewerIsSteward}
            onClose={onClose}
            onOpenFullPage={openFullPage}
            handleProps={{ onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }}
          />
        )}
      </div>

      {/* Full-page expansion overlay: the card "becomes" the page. */}
      {expanding && plant && (
        <div className="fixed inset-0 z-50 bg-background animate-[panel-expand_0.45s_cubic-bezier(0.32,0.72,0,1)_forwards] flex flex-col">
          <div className="relative h-64 shrink-0 flex items-end overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-brand-primary-light">
            <span className="absolute -right-4 -top-6 text-[11rem] leading-none opacity-20 select-none">{plant.emoji}</span>
            <div className="relative z-10 p-6 text-white">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl">{plant.emoji}</span>
                <span className={`px-2 py-0.5 backdrop-blur-md rounded text-xs font-bold uppercase tracking-wider ${STATUS_BADGE_CLASSES[plant.status] ?? "bg-primary/80"}`}>
                  {plant.status.replace(/_/g, " ")}
                </span>
              </div>
              <h2 className="text-3xl font-heading font-bold">{plant.name}</h2>
              <p className="text-sm text-white/80 italic">{plant.scientificName}</p>
            </div>
          </div>
          <div className="flex-1 flex items-start justify-center pt-10">
            <div className="w-8 h-8 rounded-full border-[3px] border-primary/30 border-t-primary animate-spin" />
          </div>
        </div>
      )}
    </>
  );
}

function PanelContent({
  plant,
  user,
  viewerIsSteward,
  onClose,
  onOpenFullPage,
  handleProps,
}: {
  plant: PlantSummary;
  user: SessionUser | null;
  viewerIsSteward: boolean;
  onClose: () => void;
  onOpenFullPage: () => void;
  handleProps: React.HTMLAttributes<HTMLDivElement>;
}) {
  const [logs, setLogs] = useState<ObservationEntry[] | null>(null);

  function loadLogs() {
    fetch(`/api/plants/${plant.id}/activity`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => setLogs(data.observations))
      .catch(() => setLogs([]));
  }

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

  return (
    <>
      {/* Header with pull-up handle */}
      <div
        className="relative h-44 shrink-0 flex items-end overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-brand-primary-light cursor-grab active:cursor-grabbing touch-none select-none"
        {...handleProps}
      >
        <span className="absolute -right-4 -top-6 text-[9rem] leading-none opacity-20 select-none">{plant.emoji}</span>

        {/* Grabber: pull up (or tap) to open the full plant page */}
        <button
          onClick={onOpenFullPage}
          className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pt-2 pb-3 px-10 flex flex-col items-center gap-0.5 text-white/80 hover:text-white transition group"
          aria-label="Open full plant page"
        >
          <div className="w-12 h-1.5 rounded-full bg-white/50 group-hover:bg-white/80 transition" />
          <ChevronUp className="w-4 h-4 -mb-1 opacity-70 group-hover:opacity-100 group-hover:-translate-y-0.5 transition" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-4 right-4 z-20 bg-black/30 text-white p-2 rounded-full hover:bg-black/50 backdrop-blur-md"
          aria-label="Close panel"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10 p-4 text-white pointer-events-none">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{plant.emoji}</span>
            <span className={`px-2 py-0.5 backdrop-blur-md rounded text-xs font-bold uppercase tracking-wider ${STATUS_BADGE_CLASSES[plant.status] ?? "bg-primary/80"}`}>
              {plant.status.replace(/_/g, " ")}
            </span>
          </div>
          <h2 className="text-2xl font-heading font-bold">{plant.name}</h2>
          <p className="text-sm text-white/80 italic">{plant.scientificName}</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 pb-24 md:pb-5">
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

        <StewardSection
          plantId={plant.id}
          founderId={plant.founderId}
          founderName={plant.plantedByName}
          upForAdoption={plant.upForAdoption}
          stewardCount={plant.stewardCount}
          viewerIsSteward={viewerIsSteward}
          user={user}
        />

        <CareActions plantId={plant.id} status={plant.status} user={user} onLogged={loadLogs} />

        <ActivityFeed logs={logs} />
      </div>
    </>
  );
}
