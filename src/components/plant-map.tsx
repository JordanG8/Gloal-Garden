"use client";

import { useState } from "react";
import Map, { Marker, NavigationControl, MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin } from "lucide-react";
import type { PlantSummary } from "@/lib/types";
import type { PlantStatus } from "@/lib/plant-status";

const STATUS_COLORS: Record<string, string> = {
  needs_water: "bg-blue-500 border-blue-200 text-white",
  ready_to_harvest: "bg-destructive border-red-200 text-white",
  needs_attention: "bg-orange-500 border-orange-200 text-white",
  diseased: "bg-orange-600 border-orange-300 text-white",
  dormant: "bg-stone-400 border-stone-200 text-white",
};

export function statusColor(status: PlantStatus): string {
  return STATUS_COLORS[status] ?? "bg-primary border-brand-primary-light text-primary-foreground";
}

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap Contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm", minzoom: 0, maxzoom: 22 }],
};

export default function PlantMap({
  plants,
  selectedPlantId,
  onSelectPlant,
  addMode,
  draftLocation,
  onPickLocation,
  mapRef,
  initialView,
}: {
  plants: PlantSummary[];
  selectedPlantId: number | null;
  onSelectPlant: (plant: PlantSummary) => void;
  addMode: boolean;
  draftLocation: { lat: number; lng: number } | null;
  onPickLocation: (loc: { lat: number; lng: number }) => void;
  mapRef: React.RefObject<MapRef | null>;
  initialView: { longitude: number; latitude: number; zoom: number };
}) {
  // Frozen first-render view: the map is uncontrolled, pan/zoom state lives in maplibre.
  const [frozenInitialView] = useState(initialView);

  return (
    <Map
      ref={mapRef}
      initialViewState={frozenInitialView}
      mapStyle={MAP_STYLE}
      cursor={addMode ? "crosshair" : "auto"}
      onClick={(e) => {
        if (addMode) onPickLocation({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }}
    >
      <NavigationControl position="bottom-right" showCompass={false} />

      {plants.map((plant) => (
        <Marker key={plant.id} longitude={plant.lng} latitude={plant.lat} anchor="bottom">
          <div
            className="relative group cursor-pointer flex flex-col items-center"
            onClick={(e) => {
              e.stopPropagation();
              if (!addMode) onSelectPlant(plant);
            }}
          >
            <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border px-3 py-1 rounded-full text-sm font-heading shadow-md whitespace-nowrap z-10 pointer-events-none">
              {plant.name}
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full shadow-lg border-[3px] transition-transform duration-300 ${statusColor(plant.status)} ${
                selectedPlantId === plant.id ? "scale-125 ring-4 ring-primary/30 z-20" : "hover:scale-110"
              }`}
            >
              <span className="text-xl leading-none">{plant.emoji}</span>
            </div>
          </div>
        </Marker>
      ))}

      {draftLocation && (
        <Marker longitude={draftLocation.lng} latitude={draftLocation.lat} anchor="bottom">
          <div className="text-primary drop-shadow-lg animate-bounce">
            <MapPin className="w-10 h-10 fill-brand-primary-light/40" />
          </div>
        </Marker>
      )}
    </Map>
  );
}
