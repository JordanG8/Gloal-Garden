import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/auth-shell";
import AuthForm from "@/components/auth-form";
import { loginAction } from "@/lib/auth-actions";

export const metadata = { title: "Sign In · Global Garden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const [session, { reset }] = await Promise.all([auth(), searchParams]);
  if (session?.user) redirect("/");

  return (
    <AuthShell>
      <AuthForm
        kicker="Welcome back"
        title="Sign in"
        subtitle="Pick up where you left off — water, log, and plant."
        notice={reset ? "Password updated. Sign in with your new password." : undefined}
        fields={[
          { name: "email", label: "Email", type: "email", placeholder: "you@example.com", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", placeholder: "Your password", autoComplete: "current-password" },
        ]}
        submitLabel="Sign in"
        action={loginAction}
        altText="New to Global Garden?"
        altHref="/signup"
        altLinkLabel="Create an account"
        showForgotLink
      />
    </AuthShell>
  );
}
