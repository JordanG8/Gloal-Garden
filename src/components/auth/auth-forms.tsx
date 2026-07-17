'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/provider';
import {
  loginAction,
  signupAction,
  requestPasswordResetAction,
  resetPasswordAction,
  resendVerificationAction,
  type AuthFormState,
  type SimpleFormState,
} from '@/lib/auth-actions';
import { Field, PasswordField, SubmitButton, FormError, FormNote } from './bits';
import { IconInfo } from '@/components/icons';

const IDLE: SimpleFormState = { status: 'idle', message: '' };
const NO_ERROR: AuthFormState = { error: '' };

export function LoginForm({ reset, verified }: { reset?: boolean; verified?: boolean }) {
  const { dict, locale } = useI18n();
  const [state, action] = useActionState(loginAction, NO_ERROR);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      {reset && <FormNote code="resetDone" tone="success" />}
      {verified && <FormNote code="alreadyVerified" tone="success" />}
      <Field label={dict.auth.email} name="email" type="email" autoComplete="email" inputMode="email" />
      <PasswordField label={dict.auth.password} name="password" autoComplete="current-password" minLength={1} />
      <Link
        href={`/${locale}/forgot-password`}
        className="self-end text-[12.5px] font-semibold text-forest hover:text-gold-deep"
      >
        {dict.auth.forgotPassword}
      </Link>
      <FormError code={state.error} />
      <SubmitButton label={dict.auth.signIn} pendingLabel={dict.auth.signingIn} />

      <div className="mt-2 flex items-center gap-3 rounded-2xl bg-moss px-[18px] py-3.5">
        <IconInfo size={18} className="shrink-0 text-leaf" />
        <p className="text-[12px] leading-normal text-forest">
          {dict.auth.demoTitle}
          <br />
          <strong dir="ltr">demo@globalgarden.app · garden123</strong>
        </p>
      </div>
    </form>
  );
}

export function SignupForm() {
  const { dict, locale } = useI18n();
  const [state, action] = useActionState(signupAction, NO_ERROR);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <Field
        label={dict.auth.displayName}
        name="displayName"
        placeholder={dict.auth.displayNamePlaceholder}
        autoComplete="name"
        minLength={2}
      />
      <Field label={dict.auth.email} name="email" type="email" autoComplete="email" inputMode="email" />
      <PasswordField
        label={dict.auth.password}
        name="password"
        autoComplete="new-password"
        hint={dict.auth.passwordHint}
      />
      <FormError code={state.error} />
      <SubmitButton label={dict.auth.signUp} pendingLabel={dict.auth.signingUp} />
    </form>
  );
}

export function ForgotPasswordForm() {
  const { dict, locale } = useI18n();
  const [state, action] = useActionState(requestPasswordResetAction, IDLE);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <Field label={dict.auth.email} name="email" type="email" autoComplete="email" inputMode="email" />
      {state.status !== 'idle' && <FormNote code={state.message} tone={state.status} />}
      <SubmitButton label={dict.auth.sendReset} pendingLabel={dict.auth.sending} />
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { dict, locale } = useI18n();
  const [state, action] = useActionState(resetPasswordAction, IDLE);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <PasswordField
        label={dict.auth.newPassword}
        name="password"
        autoComplete="new-password"
        hint={dict.auth.passwordHint}
      />
      <PasswordField label={dict.auth.confirmPassword} name="confirm" autoComplete="new-password" />
      {state.status === 'error' && <FormNote code={state.message} tone="error" />}
      <SubmitButton label={dict.auth.resetAction} pendingLabel={dict.auth.resetting} />
    </form>
  );
}

export function ResendVerification() {
  const { dict, locale } = useI18n();
  const [state, action] = useActionState(resendVerificationAction, IDLE);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      {state.status !== 'idle' && <FormNote code={state.message} tone={state.status} />}
      <SubmitButton label={dict.auth.resend} pendingLabel={dict.auth.sending} tone="forest" />
    </form>
  );
}
