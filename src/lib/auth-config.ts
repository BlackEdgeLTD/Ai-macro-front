import type { NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

export const authConfig: NextAuthConfig = {
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  callbacks: {
    jwt({ token, profile }) {
      if (profile) {
        token.oid = (profile as Record<string, unknown>).oid as string;
      }
      return token;
    },
    session({ session, token }) {
      if (token.oid) {
        session.user.oid = token.oid as string;
      }
      return session;
    },
  },
};
