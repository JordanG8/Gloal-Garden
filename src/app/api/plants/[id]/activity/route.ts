import { NextResponse } from 'next/server';
import { db } from '@/db';
import { observations, users } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import type { ObservationEntry } from '@/lib/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const plantId = parseInt(id, 10);
  if (!Number.isFinite(plantId)) {
    return NextResponse.json({ error: 'Invalid plant id' }, { status: 400 });
  }

  try {
    const rows = await db
      .select({
        id: observations.id,
        type: observations.type,
        caption: observations.caption,
        photoUrl: observations.photoUrl,
        harvestQuantity: observations.harvestQuantity,
        diseaseTag: observations.diseaseTag,
        createdAt: observations.createdAt,
        userName: users.displayName,
        userId: users.id,
        userAvatar: users.avatar,
        points: sql<number>`coalesce((
          select sum(k.points) from karma_events k
          where k.observation_id = ${observations.id}
        ), 0)::int`,
      })
      .from(observations)
      .innerJoin(users, eq(observations.userId, users.id))
      .where(eq(observations.plantId, plantId))
      .orderBy(desc(observations.createdAt), desc(observations.id))
      .limit(50);

    const entries: ObservationEntry[] = rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));

    return NextResponse.json({ observations: entries });
  } catch (error) {
    console.error('Failed to load plant activity:', error);
    return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 });
  }
}
