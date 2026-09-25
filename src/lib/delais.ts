import { estEnJoursOuvres } from "../../shared/dossiers-modele.mjs";
import { addDays, addJoursOuvres, diffDays, diffJoursOuvres, toISODate } from "./dates";

export type Niveau = "conforme" | "a_suivre" | "urgent" | "depasse";

export interface CalculDelai {
  /** Jours écoulés depuis la réception par la Banque Centrale (J+n). */
  joursEcoules: number;
  /** Le décompte est-il en jours ouvrés ? */
  ouvres: boolean;
  /** Date limite réglementaire (réception + délai réglementaire). */
  echeance: string;
  /** Jours restants avant l'échéance (négatif si dépassée). */
  delaiRestant: number;
  niveau: Niveau;
}

export const NIVEAU_LABELS: Record<Niveau, string> = {
  conforme: "Conforme",
  a_suivre: "À suivre",
  urgent: "Urgent",
  depasse: "Dépassé",
};

export function niveauPour(delaiRestant: number): Niveau {
  if (delaiRestant < 0) return "depasse";
  if (delaiRestant <= 3) return "urgent";
  if (delaiRestant <= 10) return "a_suivre";
  return "conforme";
}

/**
 * Règle métier : Délai = date du jour − date de réception du document par la
 * Banque Centrale. Rien n'est stocké : tout est recalculé à chaque rendu.
 */
export function calculerDelai(
  dateReception: string,
  delaiReglementaire: number,
  aujourdHui: string = toISODate(new Date()),
  ouvres = false,
): CalculDelai {
  /* Certains types se comptent en jours ouvrés : le catalogue du service le
     précise pour les investissements de portefeuille sortants. */
  const joursEcoules = ouvres ? diffJoursOuvres(dateReception, aujourdHui) : diffDays(dateReception, aujourdHui);
  const echeance = ouvres ? addJoursOuvres(dateReception, delaiReglementaire) : addDays(dateReception, delaiReglementaire);
  const delaiRestant = delaiReglementaire - joursEcoules;
  return { joursEcoules, ouvres, echeance, delaiRestant, niveau: niveauPour(delaiRestant) };
}

/** Raccourci : calcule le délai d'un dossier en tenant compte de son type. */
export function delaiDuDossier(
  d: { dateReception: string; delaiReglementaire: number; type: string },
  aujourdHui?: string,
): CalculDelai {
  return calculerDelai(d.dateReception, d.delaiReglementaire, aujourdHui, estEnJoursOuvres(d.type));
}
