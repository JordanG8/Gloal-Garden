"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "@/lib/auth-actions";
import {
  FieldLabel,
  FormError,
  FormHeading,
  INPUT_CLASSES,
  SubmitButton,
} from "./form-bits";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, undefined);

  return (
    <div>
      <FormHeading
        kicker="Account recovery"
        title="Choose a new password"
        subtitle="Almost there — pick something at least 8 characters long."
      />

      <form action={formAction} className="space-y-7">
        <input type="hidden" name="token" value={token} />

        <div>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            minLength={8}
            className={INPUT_CLASSES}
          />
        </div>

        <div>
          <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
          <input
            id="confirm"
            name="confirm"
            type="password"
            placeholder="Same password again"
            autoComplete="new-password"
            required
            minLength={8}
            className={INPUT_CLASSES}
          />
        </div>

        {state?.status === "error" ? <FormError>{state.message}</FormError> : null}

        <div className="pt-2">
          <SubmitButton pending={pending}>Update password</SubmitButton>
        </div>
      </form>

      <p className="mt-12 text-center text-sm text-muted-foreground">
        Link not working?{" "}
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          Request a new one
        </Link>
      </p>
    </div>
  );
}
