import "server-only";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    checks: ["pkce", "state"],
  })] : [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { error: "/?authError=1" },
  callbacks: {
    async signIn({ account, profile }) {
      return account?.provider === "google" && !!(profile as { email_verified?: boolean })?.email_verified;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.sub ?? "";
      return session;
    },
  },
};
