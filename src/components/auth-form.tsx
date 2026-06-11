"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Sprout } from "lucide-react";
import type { AuthFormState } from "@/lib/auth-actions";

interface Field {
  name: string;
  label: string;
  type: string;
  placeholder: string;
  autoComplete?: string;
}

export default function AuthForm({
  title,
  subtitle,
  fields,
  submitLabel,
  action,
  altText,
  altHref,
  altLinkLabel,
}: {
  title: string;
  subtitle: string;
  fields: Field[];
  submitLabel: string;
  action: (prevState: AuthFormState | undefined, formData: FormData) => Promise<AuthFormState>;
  altText: string;
  altHref: string;
  altLinkLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 text-primary">
          <Sprout className="w-7 h-7" />
          <span className="font-heading font-bold text-2xl tracking-tight">Global Garden</span>
        </Link>

        <div className="bg-card border border-border rounded-3xl shadow-xl p-8">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-1">{title}</h1>
          <p className="text-sm text-muted-foreground mb-6">{subtitle}</p>

          <form action={formAction} className="space-y-4">
            {fields.map((field) => (
              <div key={field.name}>
                <label htmlFor={field.name} className="block text-sm font-medium text-foreground mb-1.5">
                  {field.label}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  placeholder={field.placeholder}
                  autoComplete={field.autoComplete}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
                />
              </div>
            ))}

            {state?.error ? (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5">
                {state.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition disabled:opacity-60"
            >
              {pending ? "Please wait…" : submitLabel}
            </button>
          </form>

          <p className="text-sm text-muted-foreground mt-6 text-center">
            {altText}{" "}
            <Link href={altHref} className="text-primary font-medium hover:underline">
              {altLinkLabel}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
