import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/db";

// Configuration complète (runtime Node) : ajoute le provider Credentials qui
// vérifie l'email + mot de passe (bcrypt) contre la base de données.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        prenom: { label: "Prénom", type: "text" },
        nom: { label: "Nom", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(creds) {
        // Connexion par prénom + nom (pas d'email). Le nom peut être vide.
        const prenom = String(creds?.prenom ?? "").trim();
        const nom = String(creds?.nom ?? "").trim();
        const password = String(creds?.password ?? "");
        if (!prenom || !password) return null;

        const user = await prisma.user.findFirst({
          where: {
            prenom: { equals: prenom, mode: "insensitive" },
            nom: { equals: nom, mode: "insensitive" },
          },
          include: { worker: true },
        });
        if (!user || !user.actif) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.prenom} ${user.nom}`.trim(),
          role: user.role,
          workerId: user.worker?.id ?? null,
        };
      },
    }),
  ],
});
