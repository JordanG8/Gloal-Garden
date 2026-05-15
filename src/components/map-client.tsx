"use client";

import { useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Leaf, Droplet, Camera, AlertTriangle, X, CheckCircle2, Clock } from "lucide-react";

// --- DUMMY DATA ---
const DUMMY_PLANTS = Array.from({ length: 30 }).map((_, i) => {
  const types = [
    { icon: "🍅", category: "vegetable", name: "Cherry Tomatoes" },
    { icon: "🍋", category: "fruit", name: "Lemon Tree" },
    { icon: "🌿", category: "herb", name: "Sweet Basil" },
    { icon: "🥕", category: "vegetable", name: "Carrots" },
    { icon: "🍎", category: "fruit", name: "Apple Tree" },
    { icon: "🌶️", category: "vegetable", name: "Jalapeño" },
    { icon: "🍓", category: "fruit", name: "Wild Strawberries" },
    { icon: "🥔", category: "vegetable", name: "Potatoes" },
  ];
  const statuses = ["growing", "needs_water", "ready_to_harvest", "needs_attention"];
  
  const type = types[i % types.length];
  const status = statuses[i % statuses.length];
  
  return {
    id: i + 1,
    name: `${['Downtown', 'Plaza', 'Alley', 'Park', 'Street'][i % 5]} ${type.name}`,
    lat: 34.0522 + (Math.random() - 0.5) * 0.05,
    lng: -118.2437 + (Math.random() - 0.5) * 0.05,
    icon: type.icon,
    status,
    plantedBy: `User${Math.floor(Math.random() * 100)}`,
    daysPlanted: Math.floor(Math.random() * 200) + 10,
    wateredDaysAgo: Math.floor(Math.random() * 10),
  };
});

const DUMMY_LOGS = [
  { id: 1, user: "Alex T.", action: "Watered", time: "2 hours ago", type: "water", comment: "Looking a bit dry but perking up!" },
  { id: 2, user: "Sam R.", action: "Added Photo", time: "1 day ago", type: "photo", comment: "First blossoms are showing." },
  { id: 3, user: "Jordan M.", action: "Harvested", time: "3 days ago", type: "harvest", comment: "Took 3 ripe ones, left plenty." },
  { id: 4, user: "Chris L.", action: "Reported Pests", time: "1 week ago", type: "alert", comment: "Saw some aphids on the lower leaves." },
];

export default function MapClient() {
  const [viewState, setViewState] = useState({
    longitude: -118.2437,
    latitude: 34.0522,
    zoom: 13.5
  });
  
  const [selectedPlant, setSelectedPlant] = useState<typeof DUMMY_PLANTS[0] | null>(null);

  const getStatusColor = (status: string) => {
    switch(status) {
      case "needs_water": return "bg-blue-500 border-blue-200 text-white";
      case "ready_to_harvest": return "bg-destructive border-red-200 text-white";
      case "needs_attention": return "bg-orange-500 border-orange-200 text-white";
      default: return "bg-primary border-primary-light text-primary-foreground";
    }
  };

  return (
    <div className="w-full h-full relative map-container overflow-hidden flex">
      {/* MAP */}
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
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <div className="flex-1 h-full relative">
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
          
          {DUMMY_PLANTS.map((plant) => (
            <Marker key={plant.id} longitude={plant.lng} latitude={plant.lat} anchor="bottom">
              <div 
                className="relative group cursor-pointer flex flex-col items-center"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlant(plant);
                }}
              >
                <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border px-3 py-1 rounded-full text-sm font-heading shadow-md whitespace-nowrap z-10 pointer-events-none">
                  {plant.name}
                </div>
                <div className={`w-10 h-10 flex items-center justify-center rounded-full shadow-lg border-[3px] transition-transform duration-300 ${getStatusColor(plant.status)} ${selectedPlant?.id === plant.id ? 'scale-125 ring-4 ring-primary/30 z-20' : 'hover:scale-110'}`}>
                   <span className="text-xl leading-none">{plant.icon}</span>
                </div>
              </div>
            </Marker>
          ))}
        </Map>
      </div>

      {/* PLANT DETAIL PANEL (Desktop Side Panel / Mobile Bottom Sheet) */}
      <div 
        className={`absolute md:relative z-20 bottom-0 left-0 w-full md:w-[400px] h-[75vh] md:h-full bg-background border-t md:border-t-0 md:border-l border-border shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col ${selectedPlant ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
      >
        {selectedPlant && (
          <>
            {/* Header / Hero */}
            <div className="relative h-48 bg-muted shrink-0 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
              {/* Placeholder image */}
              <img src={`https://images.unsplash.com/photo-1592841200221-a6898f307baa?q=80&w=600&auto=format&fit=crop`} alt="Plant" className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-overlay" />
              
              <button 
                onClick={() => setSelectedPlant(null)}
                className="absolute top-4 right-4 z-20 bg-black/40 text-white p-2 rounded-full hover:bg-black/60 backdrop-blur-md"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="absolute bottom-4 left-4 z-20 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{selectedPlant.icon}</span>
                  <span className="px-2 py-0.5 bg-primary/80 backdrop-blur-md rounded text-xs font-bold uppercase tracking-wider">
                    {selectedPlant.status.replace('_', ' ')}
                  </span>
                </div>
                <h2 className="text-2xl font-heading font-bold shadow-sm">{selectedPlant.name}</h2>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 pb-24 md:pb-5">
              
              {/* Vitals */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-secondary/50 rounded-xl p-3 text-center border border-border/50">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Planted</p>
                  <p className="font-mono text-sm font-bold text-foreground">{selectedPlant.daysPlanted}d ago</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 text-center border border-border/50">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Watered</p>
                  <p className="font-mono text-sm font-bold text-foreground">{selectedPlant.wateredDaysAgo}d ago</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 text-center border border-border/50">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Caretaker</p>
                  <p className="font-mono text-sm font-bold text-foreground truncate px-1">@{selectedPlant.plantedBy}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                <button className="flex items-center justify-center gap-2 bg-blue-50 text-blue-700 py-3 rounded-xl font-medium hover:bg-blue-100 transition border border-blue-200">
                  <Droplet className="w-4 h-4" /> Water
                </button>
                <button className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground py-3 rounded-xl font-medium hover:bg-secondary/80 transition border border-border">
                  <Camera className="w-4 h-4" /> Photo
                </button>
                <button className="flex items-center justify-center gap-2 bg-destructive/10 text-destructive py-3 rounded-xl font-medium hover:bg-destructive/20 transition border border-destructive/20">
                  <CheckCircle2 className="w-4 h-4" /> Harvest
                </button>
                <button className="flex items-center justify-center gap-2 bg-orange-50 text-orange-700 py-3 rounded-xl font-medium hover:bg-orange-100 transition border border-orange-200">
                  <AlertTriangle className="w-4 h-4" /> Report
                </button>
              </div>

              {/* Activity Timeline (Logs Cards) */}
              <div className="mb-4">
                <h3 className="font-heading text-lg font-bold text-foreground mb-4 flex items-center justify-between">
                  Activity Feed
                  <span className="text-xs font-sans font-normal text-muted-foreground bg-secondary px-2 py-1 rounded-full">4 logs</span>
                </h3>
                
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {DUMMY_LOGS.map((log) => (
                    <div key={log.id} className="relative flex items-start gap-4">
                      {/* Timeline Dot */}
                      <div className="z-10 flex items-center justify-center w-10 h-10 rounded-full bg-background border-2 border-border shadow-sm shrink-0 mt-1">
                        {log.type === 'water' && <Droplet className="w-4 h-4 text-blue-500" />}
                        {log.type === 'photo' && <Camera className="w-4 h-4 text-primary" />}
                        {log.type === 'harvest' && <CheckCircle2 className="w-4 h-4 text-destructive" />}
                        {log.type === 'alert' && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                      </div>
                      
                      {/* Log Card */}
                      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm w-full">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-medium text-sm text-foreground">
                            <span className="font-bold">{log.user}</span> {log.action}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {log.time}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          "{log.comment}"
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
            </div>
          </>
        )}
      </div>
    </div>
  );
}
