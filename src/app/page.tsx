import { getGardenData, getViewerAdoptedPlantIds } from "@/lib/data";
import { getSessionUser } from "@/lib/auth-helpers";
import GardenApp from "@/components/garden-app";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string }>;
}) {
  const [user, { plants, speciesList, dbReady }, { plant: plantParam }] = await Promise.all([
    getSessionUser(),
    getGardenData(),
    searchParams,
  ]);

  const adoptedPlantIds = user ? await getViewerAdoptedPlantIds(user.id) : [];
  const initialPlantId = plantParam ? parseInt(plantParam, 10) : NaN;

  return (
    <GardenApp
      plants={plants}
      speciesList={speciesList}
      user={user}
      adoptedPlantIds={adoptedPlantIds}
      dbReady={dbReady}
      initialPlantId={Number.isFinite(initialPlantId) ? initialPlantId : null}
    />
  );
}
