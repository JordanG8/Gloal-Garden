import { AlertTriangle, CheckCircle2 } from "lucide-react";

/** Shared visual vocabulary for the account forms. */

export const INPUT_CLASSES =
  "w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[15px] text-foreground " +
  "placeholder:text-muted-foreground/50 transition focus:outline-none focus:border-ring " +
  "focus:ring-4 focus:ring-ring/15";

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
    >
      {children}
    </label>
  );
}

export function FormHeading({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-12">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
        {kicker}
      </p>
      <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground md:text-4xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>
      )}
    </header>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-13 w-full rounded-full bg-primary py-4 text-[15px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3.5 text-sm leading-relaxed text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      <p>{children}</p>
    </div>
  );
}

export function FormSuccess({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3.5 text-sm leading-relaxed text-primary">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      <p>{children}</p>
    </div>
  );
}
