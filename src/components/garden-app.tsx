"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MapRef } from "react-map-gl/maplibre";
import {
  LocateFixed, Droplet, Sprout, AlertTriangle, Plus, X, LogOut, DatabaseZap, Newspaper, UserCircle,
} from "lucide-react";
import type { PlantSummary, SessionUser, SpeciesOption } from "@/lib/types";
import { signOutAction } from "@/lib/auth-actions";
import PlantMap from "./plant-map";
import PlantPanel from "./plant-panel";
import AddPlantForm from "./add-plant-form";

type FilterKey = "needs_water" | "ready_to_harvest" | "critical" | "new";

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
  }
}

export default function GardenApp({
  plants,
  speciesList,
  user,
  dbReady,
  initialPlantId = null,
}: {
  plants: PlantSummary[];
  speciesList: SpeciesOption[];
  user: SessionUser | null;
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

  const filteredPlants = useMemo(() => {
    if (activeFilters.size === 0) return plants;
    return plants.filter((p) => [...activeFilters].some((f) => matchesFilter(p, f)));
  }, [plants, activeFilters]);

  // Keep the panel's plant in sync with refreshed server data.
  const selectedPlant = useMemo(
    () => plants.find((p) => p.id === selectedPlantId) ?? null,
    [plants, selectedPlantId]
  );

  // Keep the URL shareable without server round-trips, and bring the plant
  // into view when its card opens.
  function selectPlant(plant: PlantSummary) {
    setSelectedPlantId(plant.id);
    window.history.replaceState(null, "", `/?plant=${plant.id}`);
    const isMobile = window.innerWidth < 768;
    mapRef.current?.flyTo({
      center: [plant.lng, plant.lat],
      zoom: Math.max(mapRef.current.getZoom(), 15.5),
      duration: 900,
      // Keep the marker visible above the bottom sheet / beside the side panel.
      padding: isMobile ? { bottom: 320, top: 0, left: 0, right: 0 } : { right: 400, top: 0, left: 0, bottom: 0 },
    });
  }

  function closePanel() {
    setSelectedPlantId(null);
    window.history.replaceState(null, "", "/");
    mapRef.current?.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 600 });
  }

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

  const filterChips: { key: FilterKey; label: string; icon: React.ReactNode; classes: string; activeClasses: string }[] = [
    {
      key: "needs_water",
      label: "Needs Water",
      icon: <Droplet className="w-4 h-4" />,
      classes: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200",
      activeClasses: "bg-blue-600 text-white border-blue-600",
    },
    {
      key: "ready_to_harvest",
      label: "Harvest Ready",
      icon: <span className="text-base leading-none">🍅</span>,
      classes: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20",
      activeClasses: "bg-destructive text-white border-destructive",
    },
    {
      key: "critical",
      label: "Critical",
      icon: <AlertTriangle className="w-4 h-4" />,
      classes: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200",
      activeClasses: "bg-orange-600 text-white border-orange-600",
    },
    {
      key: "new",
      label: "Freshly Planted",
      icon: <Sprout className="w-4 h-4" />,
      classes: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20",
      activeClasses: "bg-primary text-primary-foreground border-primary",
    },
  ];

  return (
    <main className="h-screen w-full relative flex flex-col">
      {/* Header */}
      <header className="absolute top-0 left-0 w-full p-4 md:p-6 z-30 pointer-events-none flex justify-between items-start">
        <div className="bg-background/90 backdrop-blur-md px-5 py-2 rounded-full border border-border shadow-sm pointer-events-auto flex items-center gap-2">
          <span className="font-heading font-bold text-primary text-xl tracking-tight">Global Garden</span>
          <span className="hidden md:inline text-xs text-muted-foreground font-mono">
            {plants.length} plants
          </span>
        </div>

        <div className="pointer-events-auto relative flex items-center gap-2">
          <Link
            href="/feed"
            className="bg-background/90 backdrop-blur-md rounded-full p-1 border border-border shadow-sm flex items-center"
            aria-label="Community feed"
          >
            <span className="w-10 h-10 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition">
              <Newspaper className="w-5 h-5" />
            </span>
          </Link>
          <div className="bg-background/90 backdrop-blur-md rounded-full p-1 border border-border shadow-sm flex items-center">
            {user ? (
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold hover:bg-primary/30 transition"
                aria-label="Account menu"
              >
                {user.name.charAt(0).toUpperCase()}
              </button>
            ) : (
              <Link
                href="/login"
                className="px-5 py-2 font-medium text-sm hover:bg-primary/5 rounded-full transition-colors block"
              >
                Sign In
              </Link>
            )}
          </div>

          {menuOpen && user && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-background border border-border rounded-2xl shadow-xl p-2">
              <p className="px-3 py-2 text-sm font-medium text-foreground truncate">{user.name}</p>
              <Link
                href={`/gardeners/${user.id}`}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground rounded-xl hover:bg-secondary transition"
              >
                <UserCircle className="w-4 h-4" /> My profile
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive rounded-xl hover:bg-destructive/10 transition"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Database setup banner */}
      {!dbReady && (
        <div className="absolute top-20 md:top-24 left-1/2 -translate-x-1/2 z-30 bg-orange-50 border border-orange-200 text-orange-800 px-5 py-3 rounded-2xl shadow-lg max-w-[92vw] md:max-w-lg flex items-start gap-3">
          <DatabaseZap className="w-5 h-5 mt-0.5 shrink-0" />
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
        <div className="absolute top-20 md:top-24 left-1/2 -translate-x-1/2 z-30 bg-primary text-primary-foreground px-5 py-2.5 rounded-full shadow-lg text-sm font-medium animate-pulse">
          Tap the map where you planted it 🌱
        </div>
      )}

      {/* Map + side panel */}
      <div className="flex-1 w-full h-full relative map-container overflow-hidden flex">
        <div className="flex-1 h-full relative">
          <PlantMap
            plants={filteredPlants}
            selectedPlantId={selectedPlantId}
            onSelectPlant={selectPlant}
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
              <div className="bg-background/95 backdrop-blur-md border border-border rounded-3xl shadow-xl p-6 text-center max-w-sm pointer-events-auto">
                <span className="text-4xl">🌱</span>
                <h2 className="font-heading text-xl font-bold mt-2 mb-1">The garden is empty</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Be the first to put a plant on the map for your neighborhood.
                </p>
                <button
                  onClick={startAddMode}
                  className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
                >
                  Add the first plant
                </button>
              </div>
            </div>
          )}
        </div>

        <PlantPanel plant={selectedPlant} user={user} onClose={closePanel} />
      </div>

      {/* Filter dock */}
      {!addMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 md:bottom-8 md:left-8 md:translate-x-0 z-20 bg-background/80 backdrop-blur-md border border-border/50 p-3 rounded-3xl shadow-xl flex gap-2 overflow-x-auto max-w-[95vw] md:max-w-xl pointer-events-auto hide-scrollbar">
          <div className="flex gap-2 min-w-max">
            {filterChips.map((chip) => {
              const active = activeFilters.has(chip.key);
              return (
                <button
                  key={chip.key}
                  onClick={() => toggleFilter(chip.key)}
                  className={`flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 border ${
                    active ? chip.activeClasses : chip.classes
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
        className="absolute bottom-24 right-4 md:bottom-8 md:right-24 z-20 bg-background/90 backdrop-blur-sm p-3.5 rounded-full shadow-lg border border-border/50 text-primary hover:bg-background transition-colors pointer-events-auto"
        aria-label="Go to my location"
      >
        <LocateFixed className="w-6 h-6" />
      </button>

      {/* Add plant FAB */}
      <button
        onClick={addMode ? exitAddMode : startAddMode}
        className={`absolute bottom-6 right-4 md:bottom-8 md:right-8 z-20 p-4 rounded-full shadow-xl hover:scale-105 transition-transform pointer-events-auto ${
          addMode ? "bg-secondary text-secondary-foreground border border-border" : "bg-primary text-primary-foreground"
        }`}
        aria-label={addMode ? "Cancel adding plant" : "Add a plant"}
      >
        {addMode ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
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
