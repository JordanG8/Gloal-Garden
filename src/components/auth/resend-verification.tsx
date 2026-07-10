"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { resendVerificationAction } from "@/lib/auth-actions";

/**
 * "Send the link again" button with inline feedback. Used on the
 * verify-email page and in the map header's verification notice.
 */
export default function ResendVerification({ compact = false }: { compact?: boolean }) {
  const [state, formAction, pending] = useActionState(resendVerificationAction, undefined);

  return (
    <form action={formAction} className={compact ? "" : "space-y-4"}>
      <button
        type="submit"
        disabled={pending}
        className={
          compact
            ? "inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-2 hover:opacity-80 transition disabled:opacity-60"
            : "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-[15px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        }
      >
        {!compact && <Mail className="h-4 w-4" strokeWidth={1.75} />}
        {pending ? "Sending…" : "Resend verification email"}
      </button>
      {state && (
        <p
          className={`text-sm ${compact ? "mt-1.5" : ""} ${
            state.status === "error" ? "text-destructive" : compact ? "" : "text-primary"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
