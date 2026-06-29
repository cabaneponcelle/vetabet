import { z } from "zod";

// Schémas de validation partagés (API + formulaires).
const timeRe = /^\d{2}:\d{2}$/;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const availabilitySchema = z.object({
  jourSemaine: z.number().int().min(0).max(6),
  heureDebut: z.string().regex(timeRe),
  heureFin: z.string().regex(timeRe),
});

export const scheduleItemSchema = z.object({
  titre: z.string().max(200).nullish(),
  description: z.string().max(2000).nullish(),
  date: z.string().regex(dateRe, "Date attendue au format AAAA-MM-JJ"),
  heureDebut: z.string().regex(timeRe, "Heure attendue au format HH:mm"),
  heureFin: z.string().regex(timeRe, "Heure attendue au format HH:mm"),
  workerId: z.string().nullish(),
  roomId: z.string().nullish(),
  activityId: z.string().nullish(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export const workerSchema = z.object({
  prenom: z.string().min(1, "Prénom requis"),
  nom: z.string().default(""),
  // Email facultatif (identifiant interne) : on se connecte par prénom + nom.
  email: z.string().regex(emailRe, "Email invalide").optional(),
  fonction: z.string().nullish(),
  telephone: z.string().nullish(),
  actif: z.boolean().optional(),
  password: z.string().min(4, "Mot de passe : 4 caractères minimum").optional(),
  availabilities: z.array(availabilitySchema).optional(),
});

export const roomSchema = z.object({
  nom: z.string().min(1, "Nom requis"),
  type: z.string().nullish(),
  description: z.string().nullish(),
  couleur: z.string().optional(),
  actif: z.boolean().optional(),
});

export const complaintSchema = z.object({
  scheduleItemId: z.string().nullish(),
  type: z.enum(["INDISPO", "MAUVAISE_SALLE", "HORAIRE", "CONFLIT", "AUTRE"]),
  commentaire: z.string().max(2000).nullish(),
});

export const complaintStatusSchema = z.object({
  status: z.enum(["NOUVELLE", "EN_COURS", "RESOLUE", "REFUSEE"]),
});

export const leaveSchema = z
  .object({
    dateDebut: z.string().regex(dateRe, "Date de début attendue (AAAA-MM-JJ)"),
    dateFin: z.string().regex(dateRe, "Date de fin attendue (AAAA-MM-JJ)"),
    motif: z.string().max(500).nullish(),
  })
  .refine((d) => d.dateFin >= d.dateDebut, {
    message: "La date de fin doit être après la date de début.",
    path: ["dateFin"],
  });

export const leaveDecisionSchema = z.object({
  status: z.enum(["APPROUVE", "REFUSE"]),
});

export type ScheduleItemInput = z.infer<typeof scheduleItemSchema>;
export type WorkerInput = z.infer<typeof workerSchema>;
export type RoomInput = z.infer<typeof roomSchema>;
export type ComplaintInput = z.infer<typeof complaintSchema>;
