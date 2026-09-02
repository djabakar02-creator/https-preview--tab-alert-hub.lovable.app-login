import { useSyncExternalStore } from "react";
import { addDays, toISODate } from "./dates";

export type TypeDossier =
  | "transfert"
  | "investissement"
  | "emprunt"
  | "compte_devises"
  | "rapatriement"
  | "autre";

export type Statut = "en_instruction" | "en_attente_pieces" | "valide" | "rejete";

export interface Piece {
  label: string;
  fourni: boolean;
}

export interface Evenement {
  date: string; // ISO datetime
  auteur: string;
  action: string;
}

export interface Dossier {
  id: string;
  reference: string;
  demandeur: string;
  type: TypeDossier;
  montant: number;
  devise: string;
  /** Date de réception du document par la Banque Centrale (YYYY-MM-DD). */
  dateReception: string;
  /** Délai réglementaire de traitement en jours. */
  delaiReglementaire: number;
  /** Nom d'utilisateur de l'analyste traitant, ou null si non attribué. */
  analyste: string | null;
  statut: Statut;
  pieces: Piece[];
  observations: string;
  historique: Evenement[];
}

export const TYPE_LABELS: Record<TypeDossier, string> = {
  transfert: "Transfert de fonds",
  investissement: "Investissement direct étranger",
  emprunt: "Emprunt extérieur",
  compte_devises: "Ouverture de compte en devises",
  rapatriement: "Rapatriement de recettes d'exportation",
  autre: "Autre demande",
};

export const STATUT_LABELS: Record<Statut, string> = {
  en_instruction: "En instruction",
  en_attente_pieces: "En attente de pièces",
  valide: "Validé",
  rejete: "Rejeté",
};

export const DELAI_PAR_TYPE: Record<TypeDossier, number> = {
  transfert: 30,
  investissement: 45,
  emprunt: 60,
  compte_devises: 30,
  rapatriement: 30,
  autre: 30,
};

const PIECES_PAR_TYPE: Record<TypeDossier, string[]> = {
  transfert: ["Formulaire de demande", "Facture / contrat", "Justificatif d'origine des fonds", "Attestation fiscale"],
  investissement: ["Formulaire de déclaration", "Statuts de la société", "Plan de financement", "Attestation bancaire"],
  emprunt: ["Convention de prêt", "Tableau d'amortissement", "Autorisation du conseil", "Attestation fiscale"],
  compte_devises: ["Formulaire de demande", "Registre de commerce", "Justificatif d'activité", "Attestation bancaire"],
  rapatriement: ["Déclaration d'exportation", "Facture définitive", "Attestation de domiciliation", "Relevé bancaire"],
  autre: ["Formulaire de demande", "Pièce justificative"],
};

export function piecesRequises(type: TypeDossier): Piece[] {
  return PIECES_PAR_TYPE[type].map((label) => ({ label, fourni: false }));
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/* Données initiales                                                    */
/* ------------------------------------------------------------------ */

function seed(): Dossier[] {
  const today = toISODate(new Date());
  const now = new Date().toISOString();
  const recu = (days: number) => addDays(today, -days);
  const ev = (auteur: string, action: string, daysAgo: number): Evenement => ({
    date: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    auteur,
    action,
  });
  const mk = (
    n: number,
    demandeur: string,
    type: TypeDossier,
    montant: number,
    devise: string,
    joursDepuisReception: number,
    analyste: string | null,
    statut: Statut,
    fournies: number,
  ): Dossier => {
    const pieces = piecesRequises(type).map((p, i) => ({ ...p, fourni: i < fournies }));
    return {
      id: newId(),
      reference: `DRC/SA/2026/${String(n).padStart(4, "0")}`,
      demandeur,
      type,
      montant,
      devise,
      dateReception: recu(joursDepuisReception),
      delaiReglementaire: DELAI_PAR_TYPE[type],
      analyste,
      statut,
      pieces,
      observations: "",
      historique: [
        ev("admin", "Enregistrement du dossier au registre", joursDepuisReception),
        ...(analyste ? [ev("admin", `Attribution à ${analyste}`, joursDepuisReception)] : []),
      ],
    };
  };
  const d = [
    mk(41, "Ondimba Marie‑Claire", "transfert", 185_000_000, "XAF", 27, "analyste", "en_instruction", 4),
    mk(42, "SOCAGI SA", "investissement", 2_400_000, "EUR", 19, "analyste", "en_instruction", 3),
    mk(43, "Bekolo & Fils SARL", "emprunt", 950_000, "USD", 21, "hierarchie", "en_instruction", 4),
    mk(44, "Nguema Ondo Pascal", "compte_devises", 0, "XAF", 14, "analyste", "en_attente_pieces", 2),
    mk(45, "Cotonnière du Tchad", "rapatriement", 1_120_000_000, "XAF", 8, null, "en_instruction", 3),
    mk(46, "Mbappé Ekani Justine", "transfert", 45_000_000, "XAF", 3, "analyste", "en_instruction", 1),
    mk(47, "Petro‑Congo Services", "emprunt", 5_000_000, "USD", 64, "hierarchie", "en_instruction", 4),
    mk(48, "Alliance Bâtiment SA", "transfert", 320_000_000, "XAF", 35, "analyste", "valide", 4),
  ];
  d[7].historique.push({ date: now, auteur: "hierarchie", action: "Validation du dossier" });
  return d;
}

/* ------------------------------------------------------------------ */
/* Store persistant (localStorage) + abonnement React                   */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "beac-drc:dossiers:v1";
let dossiers: Dossier[] | null = null;
const listeners = new Set<() => void>();

function read(): Dossier[] {
  if (dossiers) return dossiers;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        dossiers = parsed as Dossier[];
        return dossiers;
      }
    }
  } catch {
    /* stockage corrompu ou indisponible : on repart des données initiales */
  }
  dossiers = seed();
  persist();
  return dossiers;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dossiers ?? []));
  } catch {
    /* quota ou stockage indisponible : l'état reste en mémoire */
  }
}

function commit(next: Dossier[]) {
  dossiers = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDossiers(): Dossier[] {
  return useSyncExternalStore(subscribe, read, read);
}

export function getDossiers(): Dossier[] {
  return read();
}

export function upsertDossier(d: Dossier) {
  const list = read();
  const idx = list.findIndex((x) => x.id === d.id);
  const next = idx === -1 ? [d, ...list] : list.map((x) => (x.id === d.id ? d : x));
  commit(next);
}

export function removeDossier(id: string) {
  commit(read().filter((d) => d.id !== id));
}

export function replaceAll(list: Dossier[]) {
  commit(list);
}

export function resetToSeed() {
  commit(seed());
}

export function withEvent(d: Dossier, auteur: string, action: string): Dossier {
  return { ...d, historique: [...d.historique, { date: new Date().toISOString(), auteur, action }] };
}

export function nextReference(): string {
  const year = new Date().getFullYear();
  const nums = read()
    .map((d) => d.reference.match(/(\d{4})$/)?.[1])
    .filter(Boolean)
    .map(Number);
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `DRC/SA/${year}/${String(n).padStart(4, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Import / export CSV (conservation de l'import tableur)               */
/* ------------------------------------------------------------------ */

const CSV_HEADERS = [
  "reference",
  "demandeur",
  "type",
  "montant",
  "devise",
  "dateReception",
  "delaiReglementaire",
  "analyste",
  "statut",
] as const;

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(list: Dossier[]): string {
  const rows = list.map((d) => CSV_HEADERS.map((h) => csvEscape(d[h])).join(";"));
  return [CSV_HEADERS.join(";"), ...rows].join("\n");
}

function parseCSVLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export interface ImportResult {
  dossiers: Dossier[];
  erreurs: string[];
}

const TYPES = Object.keys(TYPE_LABELS) as TypeDossier[];
const STATUTS = Object.keys(STATUT_LABELS) as Statut[];

/** Accepte un export CSV (séparateur ; ou ,) ; les lignes invalides sont signalées. */
export function fromCSV(text: string): ImportResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { dossiers: [], erreurs: ["Fichier vide ou sans ligne de données."] };
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = parseCSVLine(lines[0], sep).map((h) => h.trim());
  const idx = (h: string) => headers.indexOf(h);
  const required = ["reference", "demandeur", "type", "dateReception"];
  const missing = required.filter((h) => idx(h) === -1);
  if (missing.length) return { dossiers: [], erreurs: [`Colonnes manquantes : ${missing.join(", ")}`] };

  const erreurs: string[] = [];
  const out: Dossier[] = [];
  lines.slice(1).forEach((line, i) => {
    const c = parseCSVLine(line, sep);
    const get = (h: string) => (idx(h) === -1 ? "" : (c[idx(h)] ?? "").trim());
    const type = get("type") as TypeDossier;
    const dateReception = get("dateReception");
    if (!TYPES.includes(type)) return erreurs.push(`Ligne ${i + 2} : type inconnu « ${type} »`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateReception))
      return erreurs.push(`Ligne ${i + 2} : date de réception invalide (attendu AAAA-MM-JJ)`);
    const statut = (get("statut") || "en_instruction") as Statut;
    if (!STATUTS.includes(statut)) return erreurs.push(`Ligne ${i + 2} : statut inconnu « ${statut} »`);
    out.push({
      id: newId(),
      reference: get("reference"),
      demandeur: get("demandeur"),
      type,
      montant: Number(get("montant") || 0) || 0,
      devise: get("devise") || "XAF",
      dateReception,
      delaiReglementaire: Number(get("delaiReglementaire")) || DELAI_PAR_TYPE[type],
      analyste: get("analyste") || null,
      statut,
      pieces: piecesRequises(type),
      observations: "",
      historique: [{ date: new Date().toISOString(), auteur: "import", action: "Import tableur" }],
    });
  });
  return { dossiers: out, erreurs };
}
