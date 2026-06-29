import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Configuration « edge-safe » : pas de Prisma ni bcrypt ici (utilisée par le
// middleware qui s'exécute sur le runtime edge). La logique de connexion réelle
// (vérification du mot de passe) vit dans auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  callbacks: {
    // Protection des routes selon le rôle.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;
      const path = nextUrl.pathname;

      const destFor = (r?: string) => (r === "ADMIN" ? "/admin/dashboard" : "/worker/mon-planning");

      if (path === "/login") {
        if (isLoggedIn) return Response.redirect(new URL(destFor(role), nextUrl));
        return true;
      }

      if (path === "/") {
        if (!isLoggedIn) return Response.redirect(new URL("/login", nextUrl));
        return Response.redirect(new URL(destFor(role), nextUrl));
      }

      if (path.startsWith("/admin")) {
        if (!isLoggedIn) return false; // -> redirige vers /login
        if (role !== "ADMIN") return Response.redirect(new URL("/worker/mon-planning", nextUrl));
        return true;
      }

      if (path.startsWith("/worker")) {
        if (!isLoggedIn) return false;
        return true; // travailleur ET admin peuvent voir l'espace travailleur
      }

      return true;
    },
    // Recopie le rôle et l'id travailleur dans le token JWT.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.workerId = user.workerId ?? null;
      }
      return token;
    },
    // Expose ces infos dans la session côté serveur et client.
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.workerId = (token.workerId as string | null) ?? null;
      }
      return session;
    },
  },
  providers: [], // ajoutés dans auth.ts
} satisfies NextAuthConfig;
