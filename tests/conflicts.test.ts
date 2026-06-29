import { describe, it, expect } from "vitest";
import {
  detectConflicts,
  overlaps,
  timeToMinutes,
  dayOfWeekMonday0,
  hasBlocking,
  type ConflictItem,
  type WorkerInfo,
  type RoomInfo,
} from "../lib/conflicts";

const workers: WorkerInfo[] = [
  { id: "w1", nom: "Carole", actif: true, availabilities: [] },
  { id: "w2", nom: "Florent", actif: true, availabilities: [] },
  { id: "wOff", nom: "Lionel", actif: false, availabilities: [] },
  {
    id: "wDispo",
    nom: "Sarah",
    actif: true,
    // disponible uniquement le lundi (0) de 09:00 à 12:00
    availabilities: [{ jourSemaine: 0, heureDebut: "09:00", heureFin: "12:00" }],
  },
];

const rooms: RoomInfo[] = [
  { id: "r1", nom: "Salle d'opération 1", actif: true },
  { id: "r2", nom: "Consultation 1", actif: true },
  { id: "rOff", nom: "Salle désactivée", actif: false },
];

function item(p: Partial<ConflictItem>): ConflictItem {
  return {
    id: Math.random().toString(36).slice(2),
    date: "2026-07-13", // un lundi
    heureDebut: "09:00",
    heureFin: "10:00",
    workerId: "w1",
    roomId: "r1",
    ...p,
  };
}

describe("utilitaires horaires", () => {
  it("timeToMinutes convertit correctement", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("10:30")).toBe(630);
    expect(timeToMinutes("zz")).toBeNaN();
  });

  it("overlaps détecte le chevauchement 10-12 / 11-13", () => {
    expect(overlaps("10:00", "12:00", "11:00", "13:00")).toBe(true);
  });

  it("overlaps : créneaux adjacents (10-11 / 11-12) ne se chevauchent pas", () => {
    expect(overlaps("10:00", "11:00", "11:00", "12:00")).toBe(false);
  });

  it("dayOfWeekMonday0 : 2026-07-13 est un lundi (0)", () => {
    expect(dayOfWeekMonday0("2026-07-13")).toBe(0);
    expect(dayOfWeekMonday0("2026-07-19")).toBe(6); // dimanche
  });
});

describe("detectConflicts — contrôles par créneau", () => {
  it("aucun conflit sur un créneau valide isolé", () => {
    expect(detectConflicts([item({})], workers, rooms)).toHaveLength(0);
  });

  it("HORAIRE_INVALIDE quand fin <= début", () => {
    const c = detectConflicts([item({ heureDebut: "11:00", heureFin: "10:00" })], workers, rooms);
    expect(c.some((x) => x.type === "HORAIRE_INVALIDE")).toBe(true);
  });

  it("PAS d'INCOMPLET si seule la salle manque (salle optionnelle)", () => {
    const c = detectConflicts([item({ roomId: null })], workers, rooms);
    expect(c.some((x) => x.type === "INCOMPLET")).toBe(false);
  });

  it("INCOMPLET quand le travailleur manque", () => {
    const c = detectConflicts([item({ workerId: null })], workers, rooms);
    expect(c.some((x) => x.type === "INCOMPLET")).toBe(true);
  });

  it("SALLE_DESACTIVEE", () => {
    const c = detectConflicts([item({ roomId: "rOff" })], workers, rooms);
    expect(c.some((x) => x.type === "SALLE_DESACTIVEE")).toBe(true);
  });

  it("TRAVAILLEUR_DESACTIVE", () => {
    const c = detectConflicts([item({ workerId: "wOff" })], workers, rooms);
    expect(c.some((x) => x.type === "TRAVAILLEUR_DESACTIVE")).toBe(true);
  });

  it("HORS_DISPO (avertissement) quand hors plage de dispo", () => {
    // Sarah dispo lundi 09-12 ; on la planifie 14-15 => hors dispo
    const c = detectConflicts(
      [item({ workerId: "wDispo", heureDebut: "14:00", heureFin: "15:00" })],
      workers,
      rooms,
    );
    const hd = c.find((x) => x.type === "HORS_DISPO");
    expect(hd).toBeDefined();
    expect(hd?.severite).toBe("AVERTISSEMENT");
  });

  it("PAS de HORS_DISPO quand dans la plage", () => {
    const c = detectConflicts(
      [item({ workerId: "wDispo", heureDebut: "09:30", heureFin: "11:00" })],
      workers,
      rooms,
    );
    expect(c.some((x) => x.type === "HORS_DISPO")).toBe(false);
  });
});

describe("detectConflicts — contrôles par paire", () => {
  it("SALLE_OCCUPEE quand 2 créneaux se chevauchent dans la même salle", () => {
    const c = detectConflicts(
      [
        item({ id: "a", roomId: "r1", workerId: "w1", heureDebut: "10:00", heureFin: "12:00" }),
        item({ id: "b", roomId: "r1", workerId: "w2", heureDebut: "11:00", heureFin: "13:00" }),
      ],
      workers,
      rooms,
    );
    expect(c.some((x) => x.type === "SALLE_OCCUPEE")).toBe(true);
  });

  it("TRAVAILLEUR_DOUBLE quand le même travailleur se chevauche", () => {
    const c = detectConflicts(
      [
        item({ id: "a", workerId: "w1", roomId: "r1", heureDebut: "10:00", heureFin: "12:00" }),
        item({ id: "b", workerId: "w1", roomId: "r2", heureDebut: "11:00", heureFin: "13:00" }),
      ],
      workers,
      rooms,
    );
    expect(c.some((x) => x.type === "TRAVAILLEUR_DOUBLE")).toBe(true);
  });

  it("SUR_CONGE quand un véto en congé reste planifié sur une autre activité", () => {
    const c = detectConflicts(
      [
        item({ id: "conge", workerId: "w1", roomId: null, activityNom: "Congé", heureDebut: "07:00", heureFin: "23:00" }),
        item({ id: "consult", workerId: "w1", roomId: "r1", activityNom: "Consultation", heureDebut: "09:00", heureFin: "12:00" }),
      ],
      workers,
      rooms,
    );
    expect(c.some((x) => x.type === "SUR_CONGE")).toBe(true);
    expect(c.some((x) => x.type === "TRAVAILLEUR_DOUBLE")).toBe(false);
  });

  it("pas de conflit de paire si dates différentes", () => {
    const c = detectConflicts(
      [
        item({ id: "a", roomId: "r1", date: "2026-07-13", heureDebut: "10:00", heureFin: "12:00" }),
        item({ id: "b", roomId: "r1", date: "2026-07-14", heureDebut: "11:00", heureFin: "13:00" }),
      ],
      workers,
      rooms,
    );
    expect(c.some((x) => x.type === "SALLE_OCCUPEE")).toBe(false);
  });
});

describe("hasBlocking", () => {
  it("vrai s'il existe un conflit bloquant", () => {
    const c = detectConflicts([item({ roomId: "rOff" })], workers, rooms);
    expect(hasBlocking(c)).toBe(true);
  });

  it("faux si uniquement des avertissements", () => {
    const c = detectConflicts(
      [item({ workerId: "wDispo", heureDebut: "14:00", heureFin: "15:00" })],
      workers,
      rooms,
    );
    expect(hasBlocking(c)).toBe(false);
  });
});
