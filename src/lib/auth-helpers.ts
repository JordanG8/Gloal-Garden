import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { trustLevelFor } from './karma';
import { isEmailEnabled } from './email';
import type { SessionUser } from './types';

export async function requireUserId(): Promise<number | null> {
  const session = await auth();
  const id = session?.user?.id ? parseInt(session.user.id, 10) : NaN;
  return Number.isFinite(id) ? id : null;
}

/**
 * Session user enriched with live karma from the DB. Karma is intentionally
 * NOT baked into the JWT — it changes on every action and would go stale.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id ? parseInt(session.user.id, 10) : NaN;
  if (!Number.isFinite(id)) return null;

  let karma = 0;
  let emailVerified = true;
  try {
    const [row] = await db
      .select({ karma: users.karma, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    karma = row?.karma ?? 0;
    emailVerified = !!row?.emailVerifiedAt;
  } catch (error) {
    console.error('Failed to load viewer karma:', error);
  }

  return {
    id,
    name: session?.user?.name ?? 'Gardener',
    karma,
    trustLevel: trustLevelFor(karma).level,
    emailVerified,
    // Only nag (and gate) when the app can actually deliver the email.
    verificationRequired: isEmailEnabled() && !emailVerified,
  };
}

/**
 * Anti-sybil gate for karma-earning actions: when email delivery is
 * configured, unverified accounts can browse but not act. Returns the
 * user-facing error, or null when the action may proceed.
 */
export async function emailVerificationBlocker(userId: number): Promise<string | null> {
  if (!isEmailEnabled()) return null;
  try {
    const [row] = await db
      .select({ verifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (row?.verifiedAt) return null;
  } catch (error) {
    console.error('Failed to check email verification:', error);
    return null;
  }
  return 'Please verify your email first — check your inbox for the link, or resend it from the account menu.';
}
