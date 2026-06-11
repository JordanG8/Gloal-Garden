import { auth } from "@/auth";
import { getGardenData } from "@/lib/data";
import GardenApp from "@/components/garden-app";
import type { SessionUser } from "@/lib/types";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string }>;
}) {
  const [session, { plants, speciesList, dbReady }, { plant: plantParam }] = await Promise.all([
    auth(),
    getGardenData(),
    searchParams,
  ]);

  const initialPlantId = plantParam ? parseInt(plantParam, 10) : NaN;

  let user: SessionUser | null = null;
  if (session?.user?.id) {
    const id = parseInt(session.user.id, 10);
    if (Number.isFinite(id)) {
      user = { id, name: session.user.name ?? "Gardener" };
    }
  }

  return (
    <GardenApp
      plants={plants}
      speciesList={speciesList}
      user={user}
      dbReady={dbReady}
      initialPlantId={Number.isFinite(initialPlantId) ? initialPlantId : null}
    />
  );
}
