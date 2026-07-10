import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { authTokens } from '@/db/schema';

export type AuthTokenType = 'email_verify' | 'password_reset';

const TOKEN_TTL_MS: Record<AuthTokenType, number> = {
  email_verify: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
};

/** Minimum gap between two emails of the same type to the same user. */
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Mint a token for the user. Only the hash is persisted; the raw value is
 * returned once so it can be embedded in the emailed link. Previous unused
 * tokens of the same type are invalidated so exactly one link works.
 */
export async function createAuthToken(userId: number, type: AuthTokenType): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  const now = new Date();

  await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(and(eq(authTokens.userId, userId), eq(authTokens.type, type), isNull(authTokens.usedAt)));

  await db.insert(authTokens).values({
    userId,
    type,
    tokenHash: hashToken(raw),
    expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[type]),
  });

  return raw;
}

/**
 * Redeem a raw token: must exist, match the type, be unused, and be unexpired.
 * Marks it used atomically-enough for this flow (single UPDATE guarded on
 * used_at IS NULL) and returns the owning user id, or null if invalid.
 */
export async function consumeAuthToken(raw: string, type: AuthTokenType): Promise<number | null> {
  if (!raw || raw.length > 128) return null;
  const now = new Date();

  const updated = await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(raw)),
        eq(authTokens.type, type),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now)
      )
    )
    .returning({ userId: authTokens.userId });

  return updated[0]?.userId ?? null;
}

/** True while the user must wait before another email of this type is sent. */
export async function isOnResendCooldown(userId: number, type: AuthTokenType): Promise<boolean> {
  const [latest] = await db
    .select({ createdAt: authTokens.createdAt })
    .from(authTokens)
    .where(and(eq(authTokens.userId, userId), eq(authTokens.type, type)))
    .orderBy(desc(authTokens.createdAt))
    .limit(1);
  if (!latest) return false;
  return Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS;
}
