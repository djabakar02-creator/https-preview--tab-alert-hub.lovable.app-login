import { useEffect, useSyncExternalStore } from "react";
import * as MODELE from "../../shared/dossiers-modele.mjs";
import { api, detecterMode, type Mode } from "./api";

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
  /** Numéro de révision, tenu par le serveur : détecte les écritures concurrentes. */
  version?: number;
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

export const TYPE_LABELS: Record<TypeDossier, string> = MODELE.TYPE_LABELS;
export const STATUT_LABELS: Record<Statut, string> = MODELE.STATUT_LABELS;
export const DELAI_PAR_TYPE: Record<TypeDossier, number> = MODELE.DELAI_PAR_TYPE;

export const piecesRequises = MODELE.piecesRequises as (type: TypeDossier) => Piece[];
export const newId = MODELE.newId as () => string;


/* ------------------------------------------------------------------ */
/* Store : registre du serveur, ou du navigateur à défaut               */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "beac-drc:dossiers:v1";
const RAFRAICHIR_MS = 15_000;

let dossiers: Dossier[] = [];
let mode: Mode = "local";
const listeners = new Set<() => void>();

function notifier() {
  listeners.forEach((l) => l());
}

function persistLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dossiers));
  } catch {
    /* quota ou stockage indisponible : l'état reste en mémoire */
  }
}

function lireLocal(): Dossier[] {
  try {
    const brut = localStorage.getItem(STORAGE_KEY);
    if (brut) {
      const lu = JSON.parse(brut);
      if (Array.isArray(lu)) return lu as Dossier[];
    }
  } catch {
    /* stockage corrompu : on repart des données initiales */
  }
  return MODELE.donneesInitiales() as Dossier[];
}

function poser(next: Dossier[]) {
  dossiers = next;
  if (mode === "local") persistLocal();
  notifier();
}

let initialise: Promise<void> | null = null;

/**
 * Charge le registre : depuis le service s'il existe, sinon depuis le navigateur.
 * `connecte` évite d'appeler le registre avant qu'une session soit ouverte.
 */
export function initialiserRegistre(connecte: boolean): Promise<void> {
  if (!initialise) {
    initialise = detecterMode().then(async (m) => {
      mode = m;
      if (m === "local") return poser(lireLocal());
      if (!connecte) return poser([]);
      poser(await api.lister().catch(() => []));
    });
  }
  return initialise;
}

/** Relit le registre du serveur. Sans effet en mode local. */
export async function rafraichirRegistre(): Promise<void> {
  if (mode !== "serveur") return;
  poser(await api.lister());
}

export function modeRegistre(): Mode {
  return mode;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const snapshot = () => dossiers;

export function useDossiers(): Dossier[] {
  const liste = useSyncExternalStore(subscribe, snapshot, snapshot);
  /* En registre partagé, les dossiers changent sous les yeux de l'agent :
     on relit périodiquement, et au retour sur l'onglet. */
  useEffect(() => {
    if (mode !== "serveur") return;
    const relire = () => void rafraichirRegistre().catch(() => {});
    const minuteur = setInterval(relire, RAFRAICHIR_MS);
    window.addEventListener("focus", relire);
    return () => {
      clearInterval(minuteur);
      window.removeEventListener("focus", relire);
    };
  }, []);
  return liste;
}

export function getDossiers(): Dossier[] {
  return dossiers;
}

export async function upsertDossier(d: Dossier): Promise<void> {
  if (mode === "serveur") {
    const enregistre = await api.enregistrer(d);
    const i = dossiers.findIndex((x) => x.id === enregistre.id);
    poser(i === -1 ? [enregistre, ...dossiers] : dossiers.map((x) => (x.id === enregistre.id ? enregistre : x)));
    return;
  }
  const i = dossiers.findIndex((x) => x.id === d.id);
  poser(i === -1 ? [d, ...dossiers] : dossiers.map((x) => (x.id === d.id ? d : x)));
}

export async function removeDossier(id: string): Promise<void> {
  if (mode === "serveur") await api.supprimer(id);
  poser(dossiers.filter((d) => d.id !== id));
}

export async function replaceAll(list: Dossier[]): Promise<void> {
  poser(mode === "serveur" ? await api.importer(list) : list);
}

export async function resetToSeed(): Promise<void> {
  poser(mode === "serveur" ? await api.reinitialiser() : (MODELE.donneesInitiales() as Dossier[]));
}

export function withEvent(d: Dossier, auteur: string, action: string): Dossier {
  return { ...d, historique: [...d.historique, { date: new Date().toISOString(), auteur, action }] };
}

export function nextReference(): string {
  const year = new Date().getFullYear();
  const nums = dossiers
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
  "pieces",
  "observations",
] as const;

/** Les pièces tiennent dans une cellule : « intitulé:1|intitulé:0 ». */
function encoderPieces(pieces: Piece[]): string {
  return pieces.map((p) => `${p.label.replace(/[|:]/g, " ")}:${p.fourni ? 1 : 0}`).join("|");
}

function decoderPieces(valeur: string, type: TypeDossier): Piece[] {
  const brut = valeur.trim();
  if (!brut) return piecesRequises(type);
  const pieces = brut
    .split("|")
    .map((part) => {
      const i = part.lastIndexOf(":");
      if (i === -1) return null;
      const label = part.slice(0, i).trim();
      return label ? { label, fourni: part.slice(i + 1).trim() === "1" } : null;
    })
    .filter((p): p is Piece => p !== null);
  return pieces.length ? pieces : piecesRequises(type);
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(list: Dossier[]): string {
  const rows = list.map((d) =>
    CSV_HEADERS.map((h) => csvEscape(h === "pieces" ? encoderPieces(d.pieces) : d[h])).join(";"),
  );
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
      /* Colonnes absentes d'un fichier tiers : on retombe sur les pièces
         requises par le type, sans écraser silencieusement un état connu. */
      pieces: decoderPieces(get("pieces"), type),
      observations: get("observations"),
      historique: [{ date: new Date().toISOString(), auteur: "import", action: "Import tableur" }],
    });
  });
  return { dossiers: out, erreurs };
}
