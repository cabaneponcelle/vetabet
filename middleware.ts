import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Auth.js fournit la fonction middleware (edge-safe) à partir de la config.
const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  // S'exécute sur toutes les pages sauf les assets statiques et les routes /api.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
