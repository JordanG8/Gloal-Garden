"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requestPasswordResetAction } from "@/lib/auth-actions";
import {
  FieldLabel,
  FormError,
  FormHeading,
  FormSuccess,
  INPUT_CLASSES,
  SubmitButton,
} from "./form-bits";

export default function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, undefined);

  return (
    <div>
      <FormHeading
        kicker="Account recovery"
        title="Forgot your password?"
        subtitle="Enter the email you signed up with and we'll send you a link to choose a new one."
      />

      {state?.status === "success" ? (
        <div className="space-y-10">
          <FormSuccess>{state.message}</FormSuccess>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Didn&rsquo;t get it? Check your spam folder, or try again in a minute.
          </p>
        </div>
      ) : (
        <form action={formAction} className="space-y-7">
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              className={INPUT_CLASSES}
            />
          </div>

          {state?.status === "error" ? <FormError>{state.message}</FormError> : null}

          <div className="pt-2">
            <SubmitButton pending={pending}>Send reset link</SubmitButton>
          </div>
        </form>
      )}

      <p className="mt-12 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> Back to sign in
        </Link>
      </p>
    </div>
  );
}
