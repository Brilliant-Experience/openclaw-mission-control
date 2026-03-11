import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const ALLOWED_EMAILS = [
  "jw@brilliantexperience.com",
  "jg@brilliantexperience.com",
];

// E2E testing provider — only active when E2E_TEST_SECRET is set
const providers: Parameters<typeof NextAuth>[0]["providers"] = [Google];

if (process.env.E2E_TEST_SECRET) {
  providers.push(
    Credentials({
      id: "e2e-test",
      name: "E2E Test",
      credentials: {
        secret: { type: "text" },
      },
      authorize(credentials) {
        if (credentials?.secret === process.env.E2E_TEST_SECRET) {
          return {
            id: "e2e-test-user",
            name: "E2E Test",
            email: "jw@brilliantexperience.com",
          };
        }
        return null;
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    signIn({ account, profile }) {
      // E2E test provider bypasses email check
      if (account?.provider === "e2e-test") return true;

      const email = profile?.email?.toLowerCase();
      if (!email || !ALLOWED_EMAILS.includes(email)) {
        return false;
      }
      return true;
    },
    session({ session }) {
      return session;
    },
  },
});
