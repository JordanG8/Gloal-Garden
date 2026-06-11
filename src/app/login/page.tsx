import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";
import { loginAction } from "@/lib/auth-actions";

export const metadata = { title: "Sign In · Global Garden" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <AuthForm
      title="Welcome back"
      subtitle="Sign in to water, log, and plant."
      fields={[
        { name: "email", label: "Email", type: "email", placeholder: "you@example.com", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", placeholder: "••••••••", autoComplete: "current-password" },
      ]}
      submitLabel="Sign In"
      action={loginAction}
      altText="New to Global Garden?"
      altHref="/signup"
      altLinkLabel="Create an account"
    />
  );
}
