import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth-config";
import { ensureUserProfile } from "@/lib/user-storage";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    async signIn({ user, profile }) {
      const oid = (profile as Record<string, unknown> | undefined)?.oid as
        | string
        | undefined;
      if (oid) {
        await ensureUserProfile(oid, user.name ?? "", user.email ?? "");
      }
    },
  },
});
