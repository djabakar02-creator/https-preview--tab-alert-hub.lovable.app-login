import { useSyncExternalStore } from "react";
import * as MODELE from "../../shared/dossiers-modele.mjs";
import { api, detecterMode, type Mode } from "./api";
import type { TypeDossier } from "./dossiers";

/**
 * Comptes, délais réglementaires par défaut et journal des modifications :
 * réservés à l'administrateur (onglet Paramètres). Même principe dual-mode que
 * le registre (src/lib/dossiers.ts) — un service partagé s'il existe, sinon le
 * navigateur, pour que la démonstration hors ligne reste opérationnelle.
 *
 * En mode local, les comptes vivent dans le navigateur et leurs mots de passe
 * y sont en clair, comme les comptes de démonstration déjà embarqués dans le
 * code : ce mode ne prétend à aucune sécurité réelle, seul le mode serveur
 * (mots de passe hachés, session signée) en offre une.
 */

export type RoleCompte = "admin" | "hierarchie" | "analyste" | "lecture";

export interface Compte {
  username: string;
  displayName: string;
  role: RoleCompte;
}

interface CompteLocal extends Compte {
  password: string;
}

export interface EntreeHistorique {
  date: string;
  auteur: string;
  action: string;
}

export interface DelaiParType {
  jours: number;
  ouvres: boolean;
  source: "instruction" | "catalogue" | "defaut" | "parametre";
  /** Texte cité en regard, quand `source` est « instruction ». */
  reference?: string;
}

export const ROLE_LABELS: Record<RoleCompte, string> = {
  admin: "Administrateur",
  hierarchie: "Chef de service",
  analyste: "Agent traitant",
  lecture: "Consultation",
};

const CLE_COMPTES = "beac-drc:comptes:v1";
const CLE_DELAIS = "beac-drc:delais:v1";
const CLE_HISTORIQUE = "beac-drc:parametres-historique:v1";
const DELAIS_CATALOGUE = MODELE.DELAIS as Record<TypeDossier, DelaiParType>;

function seedComptesLocaux(): CompteLocal[] {
  return [
    { username: "admin", displayName: "Administrateur", role: "admin", password: "admin123" },
    { username: "analyste", displayName: "Agent traitant", role: "analyste", password: "analyste123" },
    { username: "hierarchie", displayName: "Chef de service", role: "hierarchie", password: "hier123" },
    { username: "lecture", displayName: "Consultation", role: "lecture", password: "lecture123" },
  ];
}

function lireJSON<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}

function ecrireJSON(cle: string, valeur: unknown) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* quota ou stockage indisponible : la modification reste en mémoire */
  }
}

/** Le mot de passe ne quitte jamais le stockage local : même forme que ce que rendrait un service. */
function sansMotDePasse({ password: _mdp, ...c }: CompteLocal): Compte {
  void _mdp;
  return c;
}

/**
 * Comptes locaux, y compris leur mot de passe. Lue par l'authentification hors
 * ligne (src/lib/auth.ts) : synchrone, comme l'était l'ancien tableau statique
 * `DEMO_ACCOUNTS`, pour rester utilisable avant toute initialisation du store.
 */
export function comptesLocaux(): CompteLocal[] {
  const lus = lireJSON<CompteLocal[] | null>(CLE_COMPTES, null);
  if (lus) return lus;
  const seed = seedComptesLocaux();
  ecrireJSON(CLE_COMPTES, seed);
  return seed;
}

/* ------------------------------------------------------------------ */
/* Store réactif                                                        */
/* ------------------------------------------------------------------ */

let mode: Mode = "local";
let comptes: Compte[] = [];
let delais: Record<TypeDossier, DelaiParType> = { ...DELAIS_CATALOGUE };
let historique: EntreeHistorique[] = [];
const listeners = new Set<() => void>();

function notifier() {
  listeners.forEach((l) => l());
}

function poser(next: { comptes?: Compte[]; delais?: Record<TypeDossier, DelaiParType>; historique?: EntreeHistorique[] }) {
  if (next.comptes) comptes = next.comptes;
  if (next.delais) delais = next.delais;
  if (next.historique) historique = next.historique;
  notifier();
}

let initialise: Promise<void> | null = null;

/**
 * Charge comptes, délais et historique. Nécessaire à tous les rôles : le
 * formulaire de dossier s'en sert pour le délai par défaut et pour la liste
 * des analystes attribuables, pas seulement l'onglet Paramètres.
 * `connecte` évite l'appel avant l'ouverture d'une session.
 */
export function initialiserParametres(connecte: boolean): Promise<void> {
  if (!initialise) {
    initialise = detecterMode().then(async (m) => {
      mode = m;
      if (m === "local") {
        const locale = lireJSON<EntreeHistorique[]>(CLE_HISTORIQUE, []);
        return poser({
          comptes: comptesLocaux().map(sansMotDePasse),
          delais: { ...DELAIS_CATALOGUE, ...lireJSON<Partial<Record<TypeDossier, DelaiParType>>>(CLE_DELAIS, {}) },
          historique: locale,
        });
      }
      if (!connecte) return;
      const [comptesDistants, p] = await Promise.all([api.listerComptes(), api.parametres()]);
      poser({
        comptes: comptesDistants,
        delais: p.delais,
        historique: [...p.historiqueComptes, ...p.historiqueDelais].sort((a, b) => (a.date < b.date ? 1 : -1)),
      });
    });
  }
  return initialise;
}

/** Relit comptes et délais du serveur. Sans effet en mode local (déjà à jour). */
export async function rafraichirParametres(): Promise<void> {
  if (mode !== "serveur") return;
  const [comptesDistants, p] = await Promise.all([api.listerComptes(), api.parametres()]);
  poser({
    comptes: comptesDistants,
    delais: p.delais,
    historique: [...p.historiqueComptes, ...p.historiqueDelais].sort((a, b) => (a.date < b.date ? 1 : -1)),
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useComptes(): Compte[] {
  return useSyncExternalStore(subscribe, () => comptes, () => comptes);
}
export function useDelais(): Record<TypeDossier, DelaiParType> {
  return useSyncExternalStore(subscribe, () => delais, () => delais);
}
export function useHistoriqueParametres(): EntreeHistorique[] {
  return useSyncExternalStore(subscribe, () => historique, () => historique);
}

function ajouterHistoriqueLocal(auteur: string, action: string) {
  historique = [{ date: new Date().toISOString(), auteur, action }, ...historique].slice(0, 200);
  ecrireJSON(CLE_HISTORIQUE, historique);
}

/* ------------------------------------------------------------------ */
/* Mutations                                                            */
/* ------------------------------------------------------------------ */

export async function creerCompte(
  acteur: string,
  c: { username: string; displayName: string; role: RoleCompte; motDePasse: string },
): Promise<void> {
  if (mode === "serveur") {
    const cree = await api.creerCompte(c);
    poser({ comptes: [...comptes, cree] });
    return rafraichirParametres();
  }
  const u = c.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(u)) throw new Error("Identifiant invalide : 3 à 32 caractères (lettres minuscules, chiffres, points, tirets).");
  const liste = comptesLocaux();
  if (liste.some((x) => x.username === u)) throw new Error(`L'identifiant « ${u} » est déjà attribué.`);
  if (!c.displayName.trim()) throw new Error("Le nom affiché est obligatoire.");
  if (c.motDePasse.length < 8) throw new Error("Le mot de passe doit compter au moins 8 caractères.");
  const suivante = [...liste, { username: u, displayName: c.displayName.trim(), role: c.role, password: c.motDePasse }];
  ecrireJSON(CLE_COMPTES, suivante);
  ajouterHistoriqueLocal(acteur, `Création du compte ${u} (${ROLE_LABELS[c.role]})`);
  poser({ comptes: suivante.map(sansMotDePasse), historique });
}

export async function modifierCompte(
  acteur: string,
  username: string,
  c: { displayName?: string; role?: RoleCompte; motDePasse?: string },
): Promise<void> {
  if (mode === "serveur") {
    await api.modifierCompte(username, c);
    return rafraichirParametres();
  }
  const liste = comptesLocaux();
  const i = liste.findIndex((x) => x.username === username);
  if (i === -1) throw new Error("Compte introuvable.");
  const actuel = liste[i];
  if (c.role && c.role !== actuel.role) {
    const nbAdmins = liste.filter((x) => x.role === "admin").length;
    if (actuel.role === "admin" && nbAdmins <= 1) throw new Error("Impossible : ce compte est le dernier administrateur restant.");
  }
  if (c.motDePasse && c.motDePasse.length < 8) throw new Error("Le mot de passe doit compter au moins 8 caractères.");
  const suivant: CompteLocal = {
    ...actuel,
    displayName: c.displayName?.trim() || actuel.displayName,
    role: c.role ?? actuel.role,
    password: c.motDePasse || actuel.password,
  };
  const suivante = [...liste];
  suivante[i] = suivant;
  ecrireJSON(CLE_COMPTES, suivante);
  const actions = [
    c.role && c.role !== actuel.role ? `Rôle de ${username} changé en ${ROLE_LABELS[c.role]}` : null,
    c.displayName && c.displayName.trim() !== actuel.displayName ? `Nom affiché de ${username} modifié` : null,
    c.motDePasse ? `Mot de passe de ${username} réinitialisé` : null,
  ].filter((a): a is string => a !== null);
  for (const a of actions) ajouterHistoriqueLocal(acteur, a);
  poser({ comptes: suivante.map(sansMotDePasse), historique });
}

export async function supprimerCompte(acteur: string, username: string): Promise<void> {
  if (mode === "serveur") {
    await api.supprimerCompte(username);
    return rafraichirParametres();
  }
  const liste = comptesLocaux();
  const c = liste.find((x) => x.username === username);
  if (!c) throw new Error("Compte introuvable.");
  if (username === acteur) throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
  const nbAdmins = liste.filter((x) => x.role === "admin").length;
  if (c.role === "admin" && nbAdmins <= 1) throw new Error("Impossible de supprimer le dernier administrateur.");
  const suivante = liste.filter((x) => x.username !== username);
  ecrireJSON(CLE_COMPTES, suivante);
  ajouterHistoriqueLocal(acteur, `Suppression du compte ${username}`);
  poser({ comptes: suivante.map(sansMotDePasse), historique });
}

export async function definirDelai(acteur: string, type: TypeDossier, d: { jours: number; ouvres: boolean }): Promise<void> {
  if (!Number.isInteger(d.jours) || d.jours <= 0 || d.jours > 3650)
    throw new Error("Le délai doit être un nombre entier de jours, entre 1 et 3650.");
  if (mode === "serveur") {
    await api.definirDelai(type, d);
    return rafraichirParametres();
  }
  const suivants = { ...delais, [type]: { jours: d.jours, ouvres: d.ouvres, source: "parametre" as const } };
  ecrireJSON(CLE_DELAIS, suivants);
  ajouterHistoriqueLocal(
    acteur,
    `Délai réglementaire « ${MODELE.TYPE_LABELS[type]} » fixé à ${d.jours} jour(s)${d.ouvres ? " ouvrés" : ""}`,
  );
  poser({ delais: suivants, historique });
}
