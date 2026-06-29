import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Garde-fous serveur réutilisables dans les pages et route handlers.

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/worker/mon-planning");
  return session;
}
