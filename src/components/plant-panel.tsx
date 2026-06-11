"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, MapPin, ChevronUp } from "lucide-react";
import type { ObservationEntry, PlantSummary, SessionUser } from "@/lib/types";
import { STATUS_BADGE_CLASSES } from "@/lib/plant-status";
import { daysAgoLabel } from "@/lib/format";
import CareActions from "./plant-care";
import ActivityFeed from "./activity-feed";
import PlantHero from "./plant-hero";

const DRAG_OPEN_THRESHOLD_PX = 70;
const EXPAND_DURATION_MS = 420;
const EXPAND_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

/** Rubber-band resistance: 1:1 up to the threshold, then progressively stiffer. */
function rubberBand(distance: number): number {
  if (distance <= DRAG_OPEN_THRESHOLD_PX) return distance;
  return DRAG_OPEN_THRESHOLD_PX + (distance - DRAG_OPEN_THRESHOLD_PX) * 0.35;
}

export default function PlantPanel({
  plant,
  user,
  onClose,
}: {
  plant: PlantSummary | null;
  user: SessionUser | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Drag state lives in refs and is applied straight to the DOM via rAF, so
  // dragging never re-renders the panel tree. React state only tracks the
  // coarse flags the UI needs.
  const drag = useRef({ active: false, startY: 0, distance: 0, raf: 0 });
  const [dragging, setDragging] = useState(false);
  const [pastThreshold, setPastThreshold] = useState(false);
  const [expandFrom, setExpandFrom] = useState<DOMRect | null>(null);

  // Prefetch the full page as soon as a plant is selected so the pull-up is instant.
  useEffect(() => {
    if (plant) router.prefetch(`/plants/${plant.id}`);
  }, [plant, router]);

  // Container transform: reveal the full-page overlay from the panel's current
  // rect via an animated clip-path, then navigate. Content never scales, so it
  // stays sharp for the whole hand-off.
  useEffect(() => {
    if (!expandFrom || !plant) return;

    const overlay = overlayRef.current;
    const plantId = plant.id;
    if (!overlay || typeof overlay.animate !== "function") {
      router.push(`/plants/${plantId}`);
      return;
    }

    const { innerWidth: vw, innerHeight: vh } = window;
    const from = `inset(${Math.max(0, expandFrom.top)}px ${Math.max(0, vw - expandFrom.right)}px ${Math.max(0, vh - expandFrom.bottom)}px ${Math.max(0, expandFrom.left)}px round 24px 24px 0 0)`;

    const animation = overlay.animate(
      [
        { clipPath: from, opacity: 0.92 },
        { clipPath: "inset(0px 0px 0px 0px round 0px)", opacity: 1 },
      ],
      { duration: EXPAND_DURATION_MS, easing: EXPAND_EASING, fill: "forwards" }
    );

    let navigated = false;
    const navigate = () => {
      if (navigated) return;
      navigated = true;
      router.push(`/plants/${plantId}`);
    };
    animation.onfinish = navigate;
    const fallback = setTimeout(navigate, EXPAND_DURATION_MS + 120);

    return () => {
      clearTimeout(fallback);
      animation.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandFrom]);

  // Switching or closing plants invalidates any in-flight expansion.
  const [prevPlantId, setPrevPlantId] = useState<number | null>(plant?.id ?? null);
  if ((plant?.id ?? null) !== prevPlantId) {
    setPrevPlantId(plant?.id ?? null);
    setExpandFrom(null);
  }

  function openFullPage() {
    if (!plant || expandFrom) return;
    applyTransform(0);
    setDragging(false);
    setPastThreshold(false);
    setExpandFrom(panelRef.current?.getBoundingClientRect() ?? new DOMRect(0, window.innerHeight, window.innerWidth, 0));
  }

  function applyTransform(distance: number) {
    const el = panelRef.current;
    if (el) el.style.transform = distance > 0 ? `translateY(-${rubberBand(distance)}px)` : "";
  }

  function onPointerDown(e: React.PointerEvent) {
    if (expandFrom) return;
    drag.current = { active: true, startY: e.clientY, distance: 0, raf: 0 };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.active) return;
    d.distance = d.startY - e.clientY;
    if (!d.raf) {
      d.raf = requestAnimationFrame(() => {
        d.raf = 0;
        applyTransform(d.distance);
        setPastThreshold(d.distance >= DRAG_OPEN_THRESHOLD_PX);
      });
    }
  }

  function onPointerUp() {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    if (d.raf) cancelAnimationFrame(d.raf);
    setDragging(false);
    setPastThreshold(false);
    if (d.distance >= DRAG_OPEN_THRESHOLD_PX) {
      openFullPage();
    } else {
      applyTransform(0);
    }
  }

  /** Ignore the handle's click event when it was really the tail end of a drag. */
  function onHandleClick() {
    if (Math.abs(drag.current.distance) > 10) return;
    openFullPage();
  }

  return (
    <>
      <div
        ref={panelRef}
        className={`absolute md:relative z-20 bottom-0 left-0 w-full md:w-[400px] h-[75vh] md:h-full bg-background border-t md:border-t-0 md:border-l border-border shadow-2xl flex flex-col ${
          dragging ? "" : "transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
        } ${
          plant ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full md:w-0 md:border-l-0 overflow-hidden"
        }`}
      >
        {/* Keyed by plant id so composer/error/feed state resets when switching plants. */}
        {plant && (
          <PanelContent
            key={plant.id}
            plant={plant}
            user={user}
            onClose={onClose}
            onHandleClick={onHandleClick}
            pastThreshold={pastThreshold}
            handleProps={{ onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }}
          />
        )}
      </div>

      {/* Full-page expansion overlay — identical layout to /plants/[id], so the
          navigation swap underneath it is invisible. */}
      {expandFrom && plant && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden"
          style={{ clipPath: "inset(100% 0px 0px 0px)", willChange: "clip-path" }}
        >
          <PlantHero plant={plant} />
          <div className="max-w-3xl mx-auto w-full p-5 md:p-10">
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[74px] md:h-[86px] bg-secondary/60 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="flex gap-2 mb-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 w-32 bg-secondary/60 rounded-full animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-secondary/60 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PanelContent({
  plant,
  user,
  onClose,
  onHandleClick,
  pastThreshold,
  handleProps,
}: {
  plant: PlantSummary;
  user: SessionUser | null;
  onClose: () => void;
  onHandleClick: () => void;
  pastThreshold: boolean;
  handleProps: React.HTMLAttributes<HTMLDivElement>;
}) {
  const [logs, setLogs] = useState<ObservationEntry[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
  }, [plant.id, refreshKey]);

  return (
    <>
      {/* Card hero doubles as the drag surface */}
      <div
        className="relative h-44 shrink-0 flex items-end overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-brand-primary-light cursor-grab active:cursor-grabbing touch-none select-none"
        {...handleProps}
      >
        <span className="absolute -right-4 -top-6 text-[9rem] leading-none opacity-20 select-none">{plant.emoji}</span>

        {/* Grabber: pull up (or tap) to open the full plant page */}
        <button
          onClick={onHandleClick}
          className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pt-2 pb-3 px-10 flex flex-col items-center gap-0.5 text-white/80 hover:text-white transition group"
          aria-label="Open full plant page"
        >
          <div
            className={`h-1.5 rounded-full transition-all duration-200 ${
              pastThreshold ? "w-16 bg-white" : "w-12 bg-white/50 group-hover:bg-white/80"
            }`}
          />
          <span
            className={`text-[10px] font-medium uppercase tracking-widest transition-all duration-200 ${
              pastThreshold ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
            }`}
          >
            Release to open
          </span>
          <ChevronUp
            className={`w-4 h-4 -mt-0.5 transition ${
              pastThreshold ? "opacity-0" : "opacity-70 group-hover:opacity-100 group-hover:-translate-y-0.5"
            }`}
          />
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
          <Link
            href={`/gardeners/${plant.plantedById}`}
            className="bg-secondary/50 rounded-xl p-3 text-center border border-border/50 hover:border-primary/40 transition"
          >
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Planted by</p>
            <p className="font-mono text-sm font-bold text-primary truncate px-1">{plant.plantedByName}</p>
          </Link>
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

        <CareActions plantId={plant.id} status={plant.status} user={user} onLogged={() => setRefreshKey((k) => k + 1)} />

        <ActivityFeed logs={logs} />
      </div>
    </>
  );
}
