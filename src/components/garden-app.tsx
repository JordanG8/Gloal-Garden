"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MapRef } from "react-map-gl/maplibre";
import {
  LocateFixed, Droplet, Sprout, AlertTriangle, Plus, X, LogOut, DatabaseZap,
  HeartHandshake, Trophy, User as UserIcon, Zap, Apple, MailWarning,
} from "lucide-react";
import type { PlantSummary, SessionUser, SpeciesOption } from "@/lib/types";
import { signOutAction } from "@/lib/auth-actions";
import { trustLevelFor, nextTrustLevel } from "@/lib/karma";
import { TrustLevelIcon } from "@/lib/plant-icons";
import ResendVerification from "./auth/resend-verification";
import PlantMap from "./plant-map";
import PlantPanel from "./plant-panel";
import AddPlantForm from "./add-plant-form";

type FilterKey = "needs_water" | "ready_to_harvest" | "critical" | "new" | "up_for_adoption";

// עדה"ס (Ada's Beer & Friends), HaZayit 33, Givat Ada — the heart of the garden.
const DEFAULT_VIEW = { longitude: 35.0047, latitude: 32.5184, zoom: 15.5 };

function matchesFilter(plant: PlantSummary, filter: FilterKey): boolean {
  switch (filter) {
    case "needs_water":
      return plant.status === "needs_water";
    case "ready_to_harvest":
      return plant.status === "ready_to_harvest";
    case "critical":
      return plant.status === "needs_attention" || plant.status === "diseased";
    case "new":
      return plant.isNew;
    case "up_for_adoption":
      return plant.upForAdoption;
  }
}

const FILTER_CHIPS: { key: FilterKey; label: string; icon: React.ReactNode }[] = [
  { key: "needs_water", label: "Needs water", icon: <Droplet className="w-4 h-4" strokeWidth={1.75} /> },
  { key: "ready_to_harvest", label: "Harvest ready", icon: <Apple className="w-4 h-4" strokeWidth={1.75} /> },
  { key: "critical", label: "Critical", icon: <AlertTriangle className="w-4 h-4" strokeWidth={1.75} /> },
  { key: "new", label: "Freshly planted", icon: <Sprout className="w-4 h-4" strokeWidth={1.75} /> },
  { key: "up_for_adoption", label: "Needs a steward", icon: <HeartHandshake className="w-4 h-4" strokeWidth={1.75} /> },
];

export default function GardenApp({
  plants,
  speciesList,
  user,
  adoptedPlantIds = [],
  dbReady,
  initialPlantId = null,
}: {
  plants: PlantSummary[];
  speciesList: SpeciesOption[];
  user: SessionUser | null;
  adoptedPlantIds?: number[];
  dbReady: boolean;
  initialPlantId?: number | null;
}) {
  const router = useRouter();
  const mapRef = useRef<MapRef | null>(null);

  const [selectedPlantId, setSelectedPlantId] = useState<number | null>(initialPlantId);
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const [addMode, setAddMode] = useState(false);
  const [draftLocation, setDraftLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [verifyNoticeDismissed, setVerifyNoticeDismissed] = useState(false);

  const filteredPlants = useMemo(() => {
    if (activeFilters.size === 0) return plants;
    return plants.filter((p) => [...activeFilters].some((f) => matchesFilter(p, f)));
  }, [plants, activeFilters]);

  // Keep the panel's plant in sync with refreshed server data.
  const selectedPlant = useMemo(
    () => plants.find((p) => p.id === selectedPlantId) ?? null,
    [plants, selectedPlantId]
  );

  function toggleFilter(key: FilterKey) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function startAddMode() {
    if (!user) {
      router.push("/login");
      return;
    }
    setSelectedPlantId(null);
    setDraftLocation(null);
    setAddMode(true);
  }

  function exitAddMode() {
    setAddMode(false);
    setDraftLocation(null);
  }

  function flyToMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 15,
          duration: 1500,
        });
      },
      () => {
        // Permission denied or unavailable — nothing to do.
      }
    );
  }

  const showVerifyNotice = !!user?.verificationRequired && !verifyNoticeDismissed;

  return (
    <main className="h-screen w-full relative flex flex-col">
      {/* Header */}
      <header className="absolute top-0 left-0 w-full px-4 pt-4 md:px-8 md:pt-6 z-30 pointer-events-none flex justify-between items-start gap-4">
        <div className="bg-background/95 backdrop-blur-md pl-5 pr-4 py-2.5 rounded-full border border-border/60 shadow-sm pointer-events-auto flex items-center gap-3">
          <Sprout className="w-4.5 h-4.5 text-primary" strokeWidth={1.75} />
          <span className="font-heading font-medium text-foreground text-lg tracking-tight">
            Global Garden
          </span>
          <span className="hidden md:inline text-xs text-muted-foreground font-mono border-l border-border pl-3">
            {plants.length} plants
          </span>
        </div>

        <div className="pointer-events-auto relative">
          <div className="bg-background/95 backdrop-blur-md rounded-full p-1 border border-border/60 shadow-sm flex items-center">
            {user ? (
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2.5 pl-4 pr-1 py-1 rounded-full hover:bg-primary/5 transition"
                aria-label="Account menu"
              >
                <span className="font-mono text-sm font-bold text-primary flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" strokeWidth={1.75} /> {user.karma}
                </span>
                <span className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </button>
            ) : (
              <Link
                href="/login"
                className="px-6 py-2.5 font-medium text-sm hover:bg-primary/5 rounded-full transition-colors block"
              >
                Sign in
              </Link>
            )}
          </div>

          {menuOpen && user && (
            <div className="absolute right-0 mt-3 w-72 bg-background border border-border rounded-3xl shadow-xl p-3">
              <div className="px-4 pt-3 pb-4 border-b border-border/60 mb-2">
                <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                <AccountTrustSummary karma={user.karma} />
              </div>
              <Link
                href={`/users/${user.id}`}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground rounded-2xl hover:bg-primary/5 transition"
                onClick={() => setMenuOpen(false)}
              >
                <UserIcon className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> My profile
              </Link>
              <Link
                href="/leaderboard"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground rounded-2xl hover:bg-primary/5 transition"
                onClick={() => setMenuOpen(false)}
              >
                <Trophy className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Leaderboard
              </Link>
              {user.verificationRequired && (
                <Link
                  href="/verify-email"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-700 rounded-2xl hover:bg-amber-50 transition"
                  onClick={() => setMenuOpen(false)}
                >
                  <MailWarning className="w-4 h-4" strokeWidth={1.75} /> Verify your email
                </Link>
              )}
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive rounded-2xl hover:bg-destructive/10 transition"
                >
                  <LogOut className="w-4 h-4" strokeWidth={1.75} /> Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Email verification notice */}
      {showVerifyNotice && !addMode && (
        <div className="absolute top-20 md:top-24 left-1/2 -translate-x-1/2 z-30 bg-amber-50 border border-amber-200 text-amber-900 px-5 py-4 rounded-3xl shadow-lg max-w-[92vw] md:max-w-md w-full flex items-start gap-3.5">
          <MailWarning className="w-5 h-5 mt-0.5 shrink-0" strokeWidth={1.75} />
          <div className="text-sm leading-relaxed min-w-0">
            <p className="font-semibold">Verify your email to start earning karma.</p>
            <p className="text-amber-800/90 mt-0.5">
              We sent a link to your inbox when you signed up.
            </p>
            <div className="mt-2">
              <ResendVerification compact />
            </div>
          </div>
          <button
            onClick={() => setVerifyNoticeDismissed(true)}
            className="p-1 rounded-full hover:bg-amber-100 transition shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Database setup banner */}
      {!dbReady && (
        <div className="absolute top-20 md:top-24 left-1/2 -translate-x-1/2 z-30 bg-orange-50 border border-orange-200 text-orange-800 px-5 py-3 rounded-2xl shadow-lg max-w-[92vw] md:max-w-lg flex items-start gap-3">
          <DatabaseZap className="w-5 h-5 mt-0.5 shrink-0" strokeWidth={1.75} />
          <p className="text-sm">
            <span className="font-bold">Database not connected.</span> Set{" "}
            <code className="font-mono text-xs bg-orange-100 px-1 py-0.5 rounded">POSTGRES_URL</code> in your
            environment, then run <code className="font-mono text-xs bg-orange-100 px-1 py-0.5 rounded">npm run db:push</code>{" "}
            and <code className="font-mono text-xs bg-orange-100 px-1 py-0.5 rounded">npm run db:seed</code>.
          </p>
        </div>
      )}

      {/* Add-mode hint */}
      {addMode && !draftLocation && (
        <div className="absolute top-20 md:top-24 left-1/2 -translate-x-1/2 z-30 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg text-sm font-medium flex items-center gap-2">
          <Sprout className="w-4 h-4 animate-pulse" strokeWidth={1.75} />
          Tap the map where you planted it
        </div>
      )}

      {/* Map + side panel */}
      <div className="flex-1 w-full h-full relative map-container overflow-hidden flex">
        <div className="flex-1 h-full relative">
          <PlantMap
            plants={filteredPlants}
            selectedPlantId={selectedPlantId}
            onSelectPlant={(plant) => setSelectedPlantId(plant.id)}
            addMode={addMode}
            draftLocation={draftLocation}
            onPickLocation={setDraftLocation}
            mapRef={mapRef}
            initialView={
              selectedPlant
                ? { longitude: selectedPlant.lng, latitude: selectedPlant.lat, zoom: 16 }
                : DEFAULT_VIEW
            }
          />

          {/* Empty state when DB is ready but garden is empty */}
          {dbReady && plants.length === 0 && !addMode && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="bg-background/95 backdrop-blur-md border border-border rounded-3xl shadow-xl px-10 py-12 text-center max-w-sm pointer-events-auto">
                <Sprout className="w-10 h-10 mx-auto text-primary" strokeWidth={1.5} />
                <h2 className="font-heading text-2xl font-medium mt-5 mb-2">The garden is empty</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-8">
                  Be the first to put a plant on the map for your neighborhood.
                </p>
                <button
                  onClick={startAddMode}
                  className="px-7 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
                >
                  Add the first plant
                </button>
              </div>
            </div>
          )}
        </div>

        <PlantPanel
          plant={selectedPlant}
          user={user}
          viewerIsSteward={selectedPlant ? adoptedPlantIds.includes(selectedPlant.id) : false}
          onClose={() => setSelectedPlantId(null)}
        />
      </div>

      {/* Filter dock */}
      {!addMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 md:bottom-8 md:left-8 md:translate-x-0 z-20 bg-background/90 backdrop-blur-md border border-border/60 p-2 rounded-full shadow-xl flex gap-1.5 overflow-x-auto max-w-[95vw] md:max-w-2xl pointer-events-auto hide-scrollbar">
          <div className="flex gap-1.5 min-w-max">
            {FILTER_CHIPS.map((chip) => {
              const active = activeFilters.has(chip.key);
              return (
                <button
                  key={chip.key}
                  onClick={() => toggleFilter(chip.key)}
                  className={`flex-shrink-0 pl-3.5 pr-4 py-2.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {chip.icon} {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Near me */}
      <button
        onClick={flyToMe}
        className="absolute bottom-24 right-4 md:bottom-8 md:right-24 z-20 bg-background/95 backdrop-blur-sm p-3.5 rounded-full shadow-lg border border-border/60 text-primary hover:bg-background transition-colors pointer-events-auto"
        aria-label="Go to my location"
      >
        <LocateFixed className="w-6 h-6" strokeWidth={1.75} />
      </button>

      {/* Add plant FAB */}
      <button
        onClick={addMode ? exitAddMode : startAddMode}
        className={`absolute bottom-6 right-4 md:bottom-8 md:right-8 z-20 p-4 rounded-full shadow-xl hover:scale-105 transition-transform pointer-events-auto ${
          addMode ? "bg-secondary text-secondary-foreground border border-border" : "bg-primary text-primary-foreground"
        }`}
        aria-label={addMode ? "Cancel adding plant" : "Add a plant"}
      >
        {addMode ? <X className="w-6 h-6" strokeWidth={1.75} /> : <Plus className="w-6 h-6" strokeWidth={1.75} />}
      </button>

      {/* Add plant form */}
      {addMode && draftLocation && (
        <AddPlantForm
          location={draftLocation}
          speciesList={speciesList}
          onCancel={exitAddMode}
          onCreated={exitAddMode}
        />
      )}
    </main>
  );
}

function AccountTrustSummary({ karma }: { karma: number }) {
  const level = trustLevelFor(karma);
  const next = nextTrustLevel(karma);
  const progress = next
    ? Math.min(100, Math.round(((karma - level.minKarma) / (next.minKarma - level.minKarma)) * 100))
    : 100;

  return (
    <div className="mt-1.5">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <TrustLevelIcon level={level.level} className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
        {level.name}
        {next && (
          <span className="font-mono"> · {next.minKarma - karma} to {next.name}</span>
        )}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
