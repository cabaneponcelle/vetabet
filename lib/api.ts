import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

// Helpers d'authentification pour les Route Handlers.

type Guard =
  | { session: Session; error?: never }
  | { session?: never; error: NextResponse };

export async function requireSession(): Promise<Guard> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }
  return { session };
}

export async function requireAdminApi(): Promise<Guard> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  }
  return { session };
}

// Normalise une erreur Zod en réponse 400 lisible.
export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}
