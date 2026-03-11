import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_EMAILS = [
  "jw@brilliantexperience.com",
  "jg@brilliantexperience.com",
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    signIn({ profile }) {
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
