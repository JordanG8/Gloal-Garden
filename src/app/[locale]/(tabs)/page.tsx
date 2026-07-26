import { Suspense } from 'react';
import { getGardenData } from '@/lib/data';
import { getSessionUser } from '@/lib/auth-helpers';
import { getInitialView } from '@/lib/map-view';
import { boundsAround } from '@/lib/map-bounds';
import { MapHome } from '@/components/map/map-home';

async function MapContent() {
  const view = await getInitialView();
  const [user, { plants, dbReady, truncated, counts }] = await Promise.all([
    getSessionUser(),
    getGardenData(boundsAround(view)),
  ]);

  return (
    <MapHome
      plants={plants}
      user={user}
      dbReady={dbReady}
      truncated={truncated}
      counts={counts}
      initialView={view}
    />
  );
}

function MapSkeleton() {
  return (
    <div className="absolute inset-0 bg-[#F0EDE2]">
      {/* Stylized placeholder map while real tiles + pins stream in */}
      <div className="absolute -start-16 -top-10 h-[260px] w-[300px] rounded-[46%_54%_60%_40%] bg-[#DFE9D1]" />
      <div className="absolute -end-20 bottom-32 h-[300px] w-[280px] rounded-[55%_45%_40%_60%] bg-[#E3EBD6]" />
      <div className="absolute start-0 top-24 h-2.5 w-[120%] -rotate-3 bg-[#FBFAF5]" />
      <div className="absolute start-0 top-80 h-3 w-[120%] rotate-2 bg-[#FBFAF5]" />
      <div className="absolute inset-x-0 top-0 flex flex-col gap-3 px-4 pt-[max(env(safe-area-inset-top),16px)]">
        <div className="flex items-center gap-2.5">
          <div className="skeleton h-11 flex-1 rounded-full" />
          <div className="skeleton h-11 w-11 rounded-full" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-9 w-20 rounded-full" />
          <div className="skeleton h-9 w-28 rounded-full" />
          <div className="skeleton h-9 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <Suspense fallback={<MapSkeleton />}>
        <MapContent />
      </Suspense>
    </div>
  );
}
