import type { MetadataRoute } from 'next';
import { db } from '@/db';
import { plants } from '@/db/schema';
import { ne } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gloal-garden.vercel.app';

// Re-generate hourly so newly planted entries get indexed.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
  ];

  try {
    const rows = await db
      .select({ id: plants.id, plantedAt: plants.plantedAt })
      .from(plants)
      .where(ne(plants.status, 'removed'));

    for (const row of rows) {
      entries.push({
        url: `${BASE_URL}/plants/${row.id}`,
        lastModified: row.plantedAt,
        changeFrequency: 'daily',
        priority: 0.7,
      });
    }
  } catch (error) {
    console.error('sitemap: failed to load plants', error);
  }

  return entries;
}
