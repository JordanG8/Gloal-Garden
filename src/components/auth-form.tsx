"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthFormState } from "@/lib/auth-actions";
import {
  FieldLabel,
  FormError,
  FormHeading,
  FormSuccess,
  INPUT_CLASSES,
  SubmitButton,
} from "./auth/form-bits";

interface Field {
  name: string;
  label: string;
  type: string;
  placeholder: string;
  autoComplete?: string;
}

export default function AuthForm({
  kicker,
  title,
  subtitle,
  fields,
  submitLabel,
  action,
  altText,
  altHref,
  altLinkLabel,
  notice,
  showForgotLink = false,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  fields: Field[];
  submitLabel: string;
  action: (prevState: AuthFormState | undefined, formData: FormData) => Promise<AuthFormState>;
  altText: string;
  altHref: string;
  altLinkLabel: string;
  /** One-time success note, e.g. after a password reset. */
  notice?: string;
  showForgotLink?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div>
      <FormHeading kicker={kicker} title={title} subtitle={subtitle} />

      {notice && !state?.error && (
        <div className="mb-8">
          <FormSuccess>{notice}</FormSuccess>
        </div>
      )}

      <form action={formAction} className="space-y-7">
        {fields.map((field) => (
          <div key={field.name}>
            <div className="flex items-baseline justify-between">
              <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
              {showForgotLink && field.type === "password" && (
                <Link
                  href="/forgot-password"
                  className="mb-2.5 text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <input
              id={field.name}
              name={field.name}
              type={field.type}
              placeholder={field.placeholder}
              autoComplete={field.autoComplete}
              required
              className={INPUT_CLASSES}
            />
          </div>
        ))}

        {state?.error ? <FormError>{state.error}</FormError> : null}

        <div className="pt-2">
          <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
        </div>
      </form>

      <p className="mt-12 text-center text-sm text-muted-foreground">
        {altText}{" "}
        <Link href={altHref} className="font-medium text-primary hover:underline">
          {altLinkLabel}
        </Link>
      </p>
    </div>
  );
}
