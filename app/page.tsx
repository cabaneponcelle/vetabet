import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Page racine : redirige selon l'état de connexion / le rôle.
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(session.user.role === "ADMIN" ? "/admin/dashboard" : "/worker/mon-planning");
}
