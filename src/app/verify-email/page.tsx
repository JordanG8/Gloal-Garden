import Link from "next/link";
import { MailCheck, MailWarning, MailQuestion } from "lucide-react";
import AuthShell from "@/components/auth/auth-shell";
import ResendVerification from "@/components/auth/resend-verification";
import { FormHeading } from "@/components/auth/form-bits";
import { verifyEmailWithToken } from "@/lib/auth-actions";
import { getSessionUser } from "@/lib/auth-helpers";

export const metadata = { title: "Verify Email · Global Garden" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const user = await getSessionUser();

  // With a token: redeem it. Without one: show the account's current status.
  let view: "verified" | "invalid" | "already" | "pending" | "signed_out";
  if (token) {
    view = (await verifyEmailWithToken(token)) ? "verified" : "invalid";
  } else if (!user) {
    view = "signed_out";
  } else {
    view = user.emailVerified ? "already" : "pending";
  }

  return (
    <AuthShell>
      {view === "verified" && (
        <div>
          <MailCheck className="mb-8 h-10 w-10 text-primary" strokeWidth={1.5} />
          <FormHeading
            kicker="Email verified"
            title="You're all set"
            subtitle="Your email is confirmed. Every care action you log now counts toward your karma."
          />
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-[15px] font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Back to the garden
          </Link>
        </div>
      )}

      {view === "invalid" && (
        <div>
          <MailWarning className="mb-8 h-10 w-10 text-destructive" strokeWidth={1.5} />
          <FormHeading
            kicker="Verification"
            title="This link has expired"
            subtitle="Verification links are single-use and expire after 24 hours."
          />
          {user ? (
            <ResendVerification />
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>{" "}
              to request a fresh link.
            </p>
          )}
        </div>
      )}

      {view === "already" && (
        <div>
          <MailCheck className="mb-8 h-10 w-10 text-primary" strokeWidth={1.5} />
          <FormHeading
            kicker="Verification"
            title="Already verified"
            subtitle="Your email is confirmed — nothing more to do here."
          />
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-[15px] font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Back to the garden
          </Link>
        </div>
      )}

      {view === "pending" && (
        <div>
          <MailQuestion className="mb-8 h-10 w-10 text-primary" strokeWidth={1.5} />
          <FormHeading
            kicker="Verification"
            title="Check your inbox"
            subtitle="We sent a verification link when you signed up. Open it to confirm your email — or send yourself a fresh one."
          />
          <ResendVerification />
        </div>
      )}

      {view === "signed_out" && (
        <div>
          <MailQuestion className="mb-8 h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
          <FormHeading
            kicker="Verification"
            title="Sign in first"
            subtitle="Sign in to check your verification status or resend the link."
          />
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-[15px] font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Sign in
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
