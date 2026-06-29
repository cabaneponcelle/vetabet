import { prisma } from "@/lib/db";

// "Anne Sophie" -> "anne.sophie" (sans accents).
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

// Génère un identifiant technique unique (champ email interne, non affiché)
// à partir du prénom/nom. L'utilisateur se connecte par prénom + nom, pas par email.
export async function uniqueInternalEmail(prenom: string, nom: string): Promise<string> {
  const base = slugify(`${prenom} ${nom}`.trim()) || "user";
  let candidate = `${base}@vetabet.local`;
  let i = 1;
  while (await prisma.user.findUnique({ where: { email: candidate } })) {
    candidate = `${base}.${i}@vetabet.local`;
    i++;
  }
  return candidate;
}
