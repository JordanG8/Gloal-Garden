import Link from "next/link";
import { KeyRound } from "lucide-react";
import AuthShell from "@/components/auth/auth-shell";
import ResetPasswordForm from "@/components/auth/reset-password-form";
import { FormHeading } from "@/components/auth/form-bits";

export const metadata = { title: "Reset Password · Global Garden" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div>
          <FormHeading
            kicker="Account recovery"
            title="Missing reset link"
            subtitle="This page only works from the link in a password-reset email."
          />
          <div className="flex items-start gap-4 rounded-2xl border border-border bg-card px-5 py-5">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Request a fresh link from the{" "}
              <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                forgot password
              </Link>{" "}
              page and open it from your inbox.
            </p>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
