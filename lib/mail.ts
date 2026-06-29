// ─────────────────────────────────────────────────────────────────────────────
//  Envoi d'email (réclamation -> RH).
//
//  Mode DEV : si aucune variable SMTP n'est configurée, l'email n'est PAS envoyé
//  réellement — il est simplement journalisé dans la console. On branchera un
//  vrai serveur SMTP en remplissant les variables SMTP_* du fichier .env.
// ─────────────────────────────────────────────────────────────────────────────
import nodemailer from "nodemailer";

interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

export async function sendMail({ to, subject, text, html }: MailInput): Promise<void> {
  // Pas de SMTP configuré -> simulation (log console).
  if (!smtpConfigured()) {
    console.log(
      "\n📧  [EMAIL SIMULÉ — aucun SMTP configuré]\n" +
        `   À      : ${to}\n` +
        `   Sujet  : ${subject}\n` +
        `   Texte  : ${text}\n`,
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "Planning Assistovet <no-reply@assistovet.local>",
    to,
    subject,
    text,
    html,
  });
}
