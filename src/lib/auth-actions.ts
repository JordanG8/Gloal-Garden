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

export interface AuthFormState {
  error: string;
}

/** Generic state for the verification / reset forms. */
export interface SimpleFormState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function baseUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function sendVerificationLink(userId: number, email: string) {
  const token = await createAuthToken(userId, 'email_verify');
  const link = `${await baseUrl()}/verify-email?token=${token}`;
  await sendEmail(verificationEmail(email, link));
}

export async function loginAction(
  _prevState: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/',
    });
    return { error: '' };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Invalid email or password.' };
    }
    throw error;
  }
}

export async function signupAction(
  _prevState: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('displayName') ?? '').trim();

  if (!EMAIL_RE.test(email)) return { error: 'Please enter a valid email address.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (displayName.length < 2) return { error: 'Display name must be at least 2 characters.' };

  try {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return { error: 'An account with that email already exists.' };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [created] = await db
      .insert(users)
      .values({ email, passwordHash, displayName })
      .returning({ id: users.id });

    // A failed send must never block account creation — the map header offers
    // a resend, and the console fallback covers unconfigured environments.
    try {
      await sendVerificationLink(created.id, email);
    } catch (error) {
      console.error('Verification email failed to send:', error);
    }
  } catch (error) {
    console.error('Signup failed:', error);
    return { error: 'Could not create account. Is the database configured?' };
  }

  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
    return { error: '' };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Account created, but sign-in failed. Please log in.' };
    }
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
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

export async function resendVerificationAction(): Promise<SimpleFormState> {
  const userId = await requireUserId();
  if (!userId) return { status: 'error', message: 'You must be signed in.' };

  try {
    const [user] = await db
      .select({ email: users.email, verifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return { status: 'error', message: 'Account not found.' };
    if (user.verifiedAt) return { status: 'success', message: 'Your email is already verified.' };

    if (await isOnResendCooldown(userId, 'email_verify')) {
      return { status: 'error', message: 'A link was just sent — check your inbox, or try again in a minute.' };
    }

    await sendVerificationLink(userId, user.email);
    return { status: 'success', message: `Verification link sent to ${user.email}.` };
  } catch (error) {
    console.error('resendVerificationAction failed:', error);
    return { status: 'error', message: 'Could not send the email. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function requestPasswordResetAction(
  _prevState: SimpleFormState | undefined,
  formData: FormData
): Promise<SimpleFormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { status: 'error', message: 'Please enter a valid email address.' };
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
      const link = `${await baseUrl()}/reset-password?token=${token}`;
      await sendEmail(passwordResetEmail(email, link));
    }
  } catch (error) {
    console.error('requestPasswordResetAction failed:', error);
    return { status: 'error', message: 'Something went wrong. Please try again.' };
  }

  return {
    status: 'success',
    message: `If an account exists for ${email}, a reset link is on its way. It expires in 1 hour.`,
  };
}

export async function resetPasswordAction(
  _prevState: SimpleFormState | undefined,
  formData: FormData
): Promise<SimpleFormState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 8) return { status: 'error', message: 'Password must be at least 8 characters.' };
  if (password !== confirm) return { status: 'error', message: 'Passwords do not match.' };

  try {
    const userId = await consumeAuthToken(token, 'password_reset');
    if (!userId) {
      return {
        status: 'error',
        message: 'This reset link is invalid or has expired. Request a new one below.',
      };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Receiving the emailed link also proves ownership of the address.
    await db
      .update(users)
      .set({ passwordHash, emailVerifiedAt: new Date() })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error('resetPasswordAction failed:', error);
    return { status: 'error', message: 'Could not update the password. Please try again.' };
  }

  redirect('/login?reset=1');
}
