'use server';

import { signIn, signOut } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';

export interface AuthFormState {
  error: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    await db.insert(users).values({ email, passwordHash, displayName });
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
