import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

// Étend les types d'Auth.js pour transporter le rôle et l'id travailleur.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      workerId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    workerId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    workerId: string | null;
  }
}
