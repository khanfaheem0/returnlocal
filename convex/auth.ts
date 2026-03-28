import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Email({
      name: "Email",
      from: "ReturnLocal <noreply@returnlocal.local>",
      authorize: undefined,
      async sendVerificationRequest({ identifier, url, expires }) {
        console.log(
          `[ReturnLocal] Magic link for ${identifier} (expires ${expires.toISOString()}): ${url}`,
        );
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      const email = (() => {
        if (typeof profile === "string") return profile;
        if (!profile || typeof profile !== "object") return undefined;
        if (!("email" in profile)) return undefined;
        const maybeEmail = (profile as { email?: unknown }).email;
        return typeof maybeEmail === "string" ? maybeEmail : undefined;
      })();

      if (existingUserId) {
        if (email) {
          await ctx.db.patch(existingUserId, {
            email,
          });
        }
        return existingUserId;
      }

      return await ctx.db.insert("users", {
        name: undefined,
        email: email ?? undefined,
        avatar: undefined,
        idSelfieUrl: undefined,
        verified: false,
        rating: 0,
        completedJobs: 0,
      });
    },
  },
});
