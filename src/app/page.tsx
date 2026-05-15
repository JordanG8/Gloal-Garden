import { auth } from "@/auth";
import MapClient from "@/components/map-client";
import { LocateFixed, Droplet, Sprout, AlertTriangle } from "lucide-react";

export default async function Home() {
  const session = await auth();

  return (
    <main className="h-screen w-full relative flex flex-col">
      {/* Top Header / Nav (Mobile floating, Desktop top bar) */}
      <header className="absolute top-0 left-0 w-full p-4 md:p-6 z-10 pointer-events-none flex justify-between items-start">
        <div className="bg-background/90 backdrop-blur-md px-5 py-2 rounded-full border border-border shadow-sm pointer-events-auto flex items-center gap-2">
          <span className="font-heading font-bold text-primary text-xl tracking-tight">Global Garden</span>
        </div>
        
        <div className="pointer-events-auto bg-background/90 backdrop-blur-md rounded-full p-1 border border-border shadow-sm flex items-center">
          {session ? (
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {session.user?.name?.charAt(0) || "U"}
            </div>
          ) : (
            <button className="px-5 py-2 font-medium text-sm hover:bg-primary/5 rounded-full transition-colors">
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Map is the full screen hero surface */}
      <div className="flex-1 w-full h-full relative">
        <MapClient />
      </div>
      
      {/* Floating filter dock (glassmorphic) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 md:bottom-8 md:left-8 md:translate-x-0 bg-background/80 backdrop-blur-md border border-border/50 p-3 rounded-3xl shadow-xl flex gap-2 overflow-x-auto max-w-[95vw] md:max-w-xl pointer-events-auto hide-scrollbar">
        <div className="flex gap-2 min-w-max">
          <button className="flex-shrink-0 px-4 py-2.5 rounded-full bg-blue-100 text-blue-800 text-sm font-medium hover:bg-blue-200 transition-colors flex items-center gap-2 border border-blue-200">
            <Droplet className="w-4 h-4" /> Needs Water
          </button>
          <button className="flex-shrink-0 px-4 py-2.5 rounded-full bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors flex items-center gap-2 border border-destructive/20">
            <span className="text-base leading-none">🍅</span> Harvest Ready
          </button>
          <button className="flex-shrink-0 px-4 py-2.5 rounded-full bg-orange-100 text-orange-800 text-sm font-medium hover:bg-orange-200 transition-colors flex items-center gap-2 border border-orange-200">
            <AlertTriangle className="w-4 h-4" /> Critical
          </button>
          <button className="flex-shrink-0 px-4 py-2.5 rounded-full bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-2 border border-primary/20">
            <Sprout className="w-4 h-4" /> Freshly Planted
          </button>
        </div>
      </div>

      {/* Near me button */}
      <button className="absolute bottom-24 right-4 md:bottom-8 md:right-8 bg-background/90 backdrop-blur-sm p-3.5 rounded-full shadow-lg border border-border/50 text-primary hover:bg-background transition-colors pointer-events-auto">
        <LocateFixed className="w-6 h-6" />
      </button>

      {/* Bottom FAB for mobile add plant (desktop could be a sidebar or button) */}
      <button className="absolute bottom-6 right-4 md:hidden bg-primary text-primary-foreground p-4 rounded-full shadow-xl hover:scale-105 transition-transform pointer-events-auto">
        <Sprout className="w-6 h-6" />
      </button>
    </main>
  );
}
