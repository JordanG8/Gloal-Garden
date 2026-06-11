import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";
import { signupAction } from "@/lib/auth-actions";

export const metadata = { title: "Sign Up · Global Garden" };

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <AuthForm
      title="Join the garden"
      subtitle="Track public plants, share harvests, and keep your neighborhood growing."
      fields={[
        { name: "displayName", label: "Display name", type: "text", placeholder: "Jordan the Gardener", autoComplete: "name" },
        { name: "email", label: "Email", type: "email", placeholder: "you@example.com", autoComplete: "email" },
        { name: "password", label: "Password (8+ characters)", type: "password", placeholder: "••••••••", autoComplete: "new-password" },
      ]}
      submitLabel="Create Account"
      action={signupAction}
      altText="Already have an account?"
      altHref="/login"
      altLinkLabel="Sign in"
    />
  );
}
