import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// console.log("lib/auth module loaded");

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Email & Password",
      credentials: { email: { label: "Email", type: "text" }, password: { label: "Password", type: "password" } },
      async authorize(creds) {
        try {
          // console.log("authorize called, creds:", creds);
          if (!creds?.email || !creds?.password) {
            // console.log("authorize: missing credentials");
            return null;
          }
          // lazy import prisma to avoid import-time failures
          const prisma = (await import("./prisma")).default;
          const user = await prisma.patient.findUnique({ where: { email: creds.email } });
          // console.log("authorize: db user:", !!user);
          if (!user) return null;
          const ok = await bcrypt.compare(creds.password, user.passwordHash);
          // console.log("authorize: password match:", ok);
          if (!ok) return null;
          return { id: String(user.id), email: user.email, name: `${user.firstName} ${user.lastName}` };
        } catch (err) {
          // console.error("authorize error:", err);
          throw err;
        }
      }
    })
  ],
  pages: { signIn: "/" },
  callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = (user as any).id ?? token.id;
      token.name = user.name ?? token.name;
      token.email = user.email ?? token.email;
    }
    return token;
  },
  async session({ session, token }) {
    if (session.user) {
      (session.user as any).id = token.id as string | undefined;
      session.user.name = token.name ?? session.user.name;
      session.user.email = token.email ?? session.user.email;
    }
    return session;
  },
},

};
