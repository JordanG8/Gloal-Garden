"use client";

import { useState } from "react";
import Map, { Marker, NavigationControl, GeolocateControl } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Leaf } from "lucide-react";

export default function MapClient() {
  const [viewState, setViewState] = useState({
    longitude: -118.2437,
    latitude: 34.0522,
    zoom: 13
  });

  return (
    <div className="w-full h-full relative map-container">
      {/* 
        To achieve the "botanical, earthy, muted" map design without an API key, 
        we use raw OSM tiles and apply CSS filters to tint them.
      */}
      <style jsx global>{`
        .map-container .maplibregl-canvas {
          filter: sepia(0.2) hue-rotate(-15deg) saturate(0.85) brightness(0.98);
        }
        .maplibregl-ctrl-group {
          background-color: var(--background) !important;
          border-radius: 0.75rem !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
          border: 1px solid var(--border) !important;
        }
        .maplibregl-ctrl-icon {
          filter: grayscale(1) opacity(0.7) !important;
        }
      `}</style>

      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle={{
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "&copy; OpenStreetMap Contributors",
            }
          },
          layers: [
            {
              id: "osm",
              type: "raster",
              source: "osm",
              minzoom: 0,
              maxzoom: 22
            }
          ]
        }}
        mapLib={maplibregl as any}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        
        {/* Sample Custom Marker for a plant */}
        <Marker longitude={-118.2437} latitude={34.0522} anchor="bottom">
          <div className="relative group cursor-pointer flex flex-col items-center">
            <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border px-3 py-1 rounded-full text-sm font-heading shadow-md whitespace-nowrap z-10">
              Cherry Tomatoes
            </div>
            <div className="w-10 h-10 flex items-center justify-center bg-destructive text-primary-foreground rounded-full shadow-lg border-[3px] border-background animate-pulse transition-transform hover:scale-110">
               {/* Custom SVG Glyph or Emoji */}
               <Leaf className="w-5 h-5 text-white" />
            </div>
          </div>
        </Marker>
      </Map>
    </div>
  );
}
