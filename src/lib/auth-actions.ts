'use server';

import { signIn, signOut } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAuthToken, consumeAuthToken, isOnResendCooldown } from './auth-tokens';
import { sendEmail, verificationEmail, passwordResetEmail } from './email';
import { requireUserId } from './auth-helpers';
import { isLocale, type Locale } from '@/i18n/config';

/**
 * Form states carry machine keys (not English copy) so every screen can
 * render them in the visitor's language via dict.authErrors[key].
 */
export interface AuthFormState {
  error: string;
}

export interface SimpleFormState {
  status: 'idle' | 'success' | 'error';
  /** dict.authErrors key */
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function localeOf(formData: FormData): Locale {
  const raw = String(formData.get('locale') ?? '');
  return isLocale(raw) ? raw : 'en';
}

async function baseUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function sendVerificationLink(userId: number, email: string, locale: Locale) {
  const token = await createAuthToken(userId, 'email_verify');
  const link = `${await baseUrl()}/${locale}/verify-email?token=${token}`;
  await sendEmail(verificationEmail(email, link, locale));
}

export async function loginAction(
  _prevState: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  const locale = localeOf(formData);
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: `/${locale}`,
    });
    return { error: '' };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'invalidCredentials' };
    }
    throw error;
  }
}

export async function signupAction(
  _prevState: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  const locale = localeOf(formData);
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('displayName') ?? '').trim();

  if (!EMAIL_RE.test(email)) return { error: 'invalidEmail' };
  if (password.length < 8) return { error: 'passwordShort' };
  if (displayName.length < 2) return { error: 'nameShort' };

  try {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return { error: 'emailTaken' };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [created] = await db
      .insert(users)
      .values({ email, passwordHash, displayName })
      .returning({ id: users.id });

    // A failed send must never block account creation — the verify screen
    // offers a resend, and the console fallback covers unconfigured envs.
    try {
      await sendVerificationLink(created.id, email, locale);
    } catch (error) {
      console.error('Verification email failed to send:', error);
    }
  } catch (error) {
    console.error('Signup failed:', error);
    return { error: 'createFailed' };
  }

  try {
    await signIn('credentials', { email, password, redirectTo: `/${locale}/verify-email` });
    return { error: '' };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'signinFailed' };
    }
    throw error;
  }
}

export async function googleSignInAction(formData: FormData) {
  const locale = localeOf(formData);
  await signIn('auth0', { redirectTo: `/${locale}` });
}

export async function signOutAction(locale: string) {
  const target = isLocale(locale) ? locale : 'en';
  await signOut({ redirectTo: `/${target}/welcome` });
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

/** Redeems the emailed token. Used by the /verify-email page. */
export async function verifyEmailWithToken(token: string): Promise<boolean> {
  try {
    const userId = await consumeAuthToken(token, 'email_verify');
    if (!userId) return false;
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, userId));
    return true;
  } catch (error) {
    console.error('verifyEmailWithToken failed:', error);
    return false;
  }
}

export async function resendVerificationAction(
  _prev: SimpleFormState | undefined,
  formData: FormData
): Promise<SimpleFormState> {
  const locale = localeOf(formData);
  const userId = await requireUserId();
  if (!userId) return { status: 'error', message: 'notSignedIn' };

  try {
    const [user] = await db
      .select({ email: users.email, verifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return { status: 'error', message: 'accountMissing' };
    if (user.verifiedAt) return { status: 'success', message: 'alreadyVerified' };

    if (await isOnResendCooldown(userId, 'email_verify')) {
      return { status: 'error', message: 'justSent' };
    }

    await sendVerificationLink(userId, user.email, locale);
    return { status: 'success', message: 'sent' };
  } catch (error) {
    console.error('resendVerificationAction failed:', error);
    return { status: 'error', message: 'sendFailed' };
  }
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function requestPasswordResetAction(
  _prevState: SimpleFormState | undefined,
  formData: FormData
): Promise<SimpleFormState> {
  const locale = localeOf(formData);
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { status: 'error', message: 'invalidEmail' };
  }

  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Deliberately identical response whether or not the account exists,
    // so this form can't be used to probe for registered emails.
    if (user && !(await isOnResendCooldown(user.id, 'password_reset'))) {
      const token = await createAuthToken(user.id, 'password_reset');
      const link = `${await baseUrl()}/${locale}/reset-password?token=${token}`;
      await sendEmail(passwordResetEmail(email, link, locale));
    }
  } catch (error) {
    console.error('requestPasswordResetAction failed:', error);
    return { status: 'error', message: 'sendFailed' };
  }

  return { status: 'success', message: 'resetSent' };
}

export async function resetPasswordAction(
  _prevState: SimpleFormState | undefined,
  formData: FormData
): Promise<SimpleFormState> {
  const locale = localeOf(formData);
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 8) return { status: 'error', message: 'passwordShort' };
  if (password !== confirm) return { status: 'error', message: 'passwordMismatch' };

  try {
    const userId = await consumeAuthToken(token, 'password_reset');
    if (!userId) {
      return { status: 'error', message: 'resetInvalid' };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Receiving the emailed link also proves ownership of the address.
    await db
      .update(users)
      .set({ passwordHash, emailVerifiedAt: new Date() })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error('resetPasswordAction failed:', error);
    return { status: 'error', message: 'saveFailed' };
  }

  redirect(`/${locale}/login?reset=1`);
}
