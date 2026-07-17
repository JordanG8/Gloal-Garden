import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Auth0 from "next-auth/providers/auth0";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { upsertOAuthUser } from "@/lib/oauth-users";

// Google sign-in rides on Auth0's Google social connection (its shared "dev
// keys" work with zero Google Cloud setup). Only registered when configured,
// so the app runs fine with just email/password until these are set.
const googleSignInEnabled = !!(
  process.env.AUTH0_CLIENT_ID &&
  process.env.AUTH0_CLIENT_SECRET &&
  process.env.AUTH0_ISSUER
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = (credentials.email as string).trim().toLowerCase();
        const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
        const user = result[0];

        if (!user) {
          return null;
        }

        const passwordsMatch = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (passwordsMatch) {
          return { id: user.id.toString(), email: user.email, name: user.displayName, image: user.avatar };
        }
        return null;
      },
    }),
    ...(googleSignInEnabled
      ? [
          Auth0({
            clientId: process.env.AUTH0_CLIENT_ID,
            clientSecret: process.env.AUTH0_CLIENT_SECRET,
            issuer: process.env.AUTH0_ISSUER,
            // Send Google directly, skipping Auth0's own login page.
            authorization: { params: { connection: "google-oauth2" } },
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "auth0" && profile?.email) {
        // Map the OAuth identity onto our own users table, so downstream
        // code (karma, badges, sessions) never has to know the login method.
        const oauthUser = await upsertOAuthUser({
          email: profile.email as string,
          name: (profile.name as string | undefined) ?? null,
          picture: (profile.picture as string | undefined) ?? null,
        });
        token.sub = oauthUser.id.toString();
        return token;
      }
      if (user) {
        token.sub = user.id;
      }
      return token;
    }
  },
  session: { strategy: "jwt" }
});

export { googleSignInEnabled };
