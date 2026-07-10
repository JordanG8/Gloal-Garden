import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/auth-shell";
import AuthForm from "@/components/auth-form";
import { signupAction } from "@/lib/auth-actions";

export const metadata = { title: "Sign Up · Global Garden" };

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <AuthShell>
      <AuthForm
        kicker="Join the garden"
        title="Create your account"
        subtitle="Track public plants, share harvests, and keep your neighborhood growing."
        fields={[
          { name: "displayName", label: "Display name", type: "text", placeholder: "Jordan the Gardener", autoComplete: "name" },
          { name: "email", label: "Email", type: "email", placeholder: "you@example.com", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", placeholder: "At least 8 characters", autoComplete: "new-password" },
        ]}
        submitLabel="Create account"
        action={signupAction}
        altText="Already have an account?"
        altHref="/login"
        altLinkLabel="Sign in"
      />
    </AuthShell>
  );
}
