import { diffDays, parseISODate, toISODate } from "./dates";
import { delaiDuDossier, NIVEAU_LABELS, type CalculDelai, type Niveau } from "./delais";
import { STATUT_LABELS, TYPE_LABELS, type Dossier, type Statut, type TypeDossier } from "./dossiers";

/**
 * Synthèse du registre. Calcul pur, sans état ni rendu : la page et les
 * exports PDF et tableur s'appuient tous les trois dessus, ce qui garantit que
 * le document téléchargé dit exactement ce que l'écran affiche.
 */

export interface Repartition<K extends string> {
  cle: K;
  libelle: string;
  nombre: number;
  part: number;
}

export interface LigneType {
  type: TypeDossier;
  libelle: string;
  total: number;
  enCours: number;
  clos: number;
  delaiMoyen: number | null;
  urgents: number;
  depasses: number;
  completude: number;
}

export interface LigneAnalyste {
  analyste: string;
  /* Charge actuelle : dossiers encore ouverts. */
  enCours: number;
  urgents: number;
  depasses: number;
  delaiMin: number | null;
  /* Performance : dossiers clos (validés ou rejetés) dans le périmètre. */
  traites: number;
  valides: number;
  rejetes: number;
  /** Délai moyen de traitement, réception → clôture, en jours (null si aucune clôture datée). */
  delaiTraitementMoyen: number | null;
  /** Part des dossiers clos dont la clôture est intervenue dans le délai réglementaire (null si aucune clôture datée). */
  tauxDansLesDelais: number | null;
}

export interface LigneDevise {
  devise: string;
  nombre: number;
  montant: number;
}

export interface LigneMois {
  mois: string;
  libelle: string;
  nombre: number;
}

export interface Rapport {
  genereLe: Date;
  perimetre: string;
  total: number;
  enCours: number;
  clos: number;
  parNiveau: Repartition<Niveau>[];
  parStatut: Repartition<Statut>[];
  parType: LigneType[];
  parAnalyste: LigneAnalyste[];
  parDevise: LigneDevise[];
  parMois: LigneMois[];
  delaiMoyen: number | null;
  delaiMedian: number | null;
  delaiMin: number | null;
  /** Part des dossiers en cours encore dans les délais, en pourcentage. */
  tauxRespect: number | null;
  /** Part des pièces fournies sur l'ensemble des dossiers, en pourcentage. */
  completude: number | null;
  dossiersComplets: number;
  piecesManquantes: number;
  nonAttribues: number;
  /** Ancienneté du plus ancien dossier encore en cours, en jours. */
  ancienneteMax: number | null;
}

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const EST_CLOS = (s: Statut) => s === "valide" || s === "rejete";

function mediane(valeurs: number[]): number | null {
  if (!valeurs.length) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(tri.length / 2);
  return tri.length % 2 ? tri[m] : Math.round((tri[m - 1] + tri[m]) / 2);
}

const moyenne = (v: number[]): number | null => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null);
const part = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

/**
 * Date de clôture d'un dossier (validation ou rejet), retrouvée dans son
 * historique. Un dossier clos sans cet événement — importé déjà clos, par
 * exemple — n'entre pas dans les moyennes de délai de traitement : mieux
 * vaut une donnée absente qu'une date supposée.
 */
function dateCloture(d: Dossier): string | null {
  const ev = [...d.historique].reverse().find((h) => h.action === "Validation du dossier" || h.action === "Rejet du dossier");
  return ev ? toISODate(new Date(ev.date)) : null;
}

export function construireRapport(
  dossiers: Dossier[],
  perimetre = "Registre complet",
  aujourdHui: string = toISODate(new Date()),
): Rapport {
  const calc = dossiers.map((d) => ({ d, c: delaiDuDossier(d, aujourdHui) }));
  const enCours = calc.filter((x) => !EST_CLOS(x.d.statut));
  const restants = enCours.map((x) => x.c.delaiRestant);

  const parType: LigneType[] = (Object.keys(TYPE_LABELS) as TypeDossier[])
    .map((type) => {
      const duType = calc.filter((x) => x.d.type === type);
      const ouverts = duType.filter((x) => !EST_CLOS(x.d.statut));
      const pieces = duType.flatMap((x) => x.d.pieces);
      return {
        type,
        libelle: TYPE_LABELS[type],
        total: duType.length,
        enCours: ouverts.length,
        clos: duType.length - ouverts.length,
        delaiMoyen: moyenne(ouverts.map((x) => x.c.delaiRestant)),
        urgents: ouverts.filter((x) => x.c.niveau === "urgent").length,
        depasses: ouverts.filter((x) => x.c.niveau === "depasse").length,
        completude: pieces.length ? part(pieces.filter((p) => p.fourni).length, pieces.length) : 0,
      };
    })
    .filter((l) => l.total > 0);

  const analystes = [...new Set(dossiers.map((d) => d.analyste))].sort((a, b) =>
    a === null ? 1 : b === null ? -1 : a.localeCompare(b),
  );
  const parAnalyste: LigneAnalyste[] = analystes.map((a) => {
    const siens = enCours.filter((x) => x.d.analyste === a);
    const clos = calc.filter((x) => EST_CLOS(x.d.statut) && x.d.analyste === a);
    /* Le délai de traitement se juge à la date de clôture, pas à aujourd'hui :
       un dossier validé il y a six mois n'est pas « en retard » pour autant. */
    const auCloture = clos
      .map((x) => {
        const dc = dateCloture(x.d);
        return dc ? { d: x.d, dc, c: delaiDuDossier(x.d, dc) } : null;
      })
      .filter((x): x is { d: Dossier; dc: string; c: CalculDelai } => x !== null);
    return {
      analyste: a ?? "Non attribué",
      enCours: siens.length,
      urgents: siens.filter((x) => x.c.niveau === "urgent").length,
      depasses: siens.filter((x) => x.c.niveau === "depasse").length,
      delaiMin: siens.length ? Math.min(...siens.map((x) => x.c.delaiRestant)) : null,
      traites: clos.length,
      valides: clos.filter((x) => x.d.statut === "valide").length,
      rejetes: clos.filter((x) => x.d.statut === "rejete").length,
      delaiTraitementMoyen: moyenne(auCloture.map((x) => diffDays(x.d.dateReception, x.dc))),
      tauxDansLesDelais: auCloture.length ? part(auCloture.filter((x) => x.c.delaiRestant >= 0).length, auCloture.length) : null,
    };
  });

  const devises = new Map<string, LigneDevise>();
  for (const { d } of calc) {
    if (!d.montant) continue;
    const l = devises.get(d.devise) ?? { devise: d.devise, nombre: 0, montant: 0 };
    l.nombre += 1;
    l.montant += d.montant;
    devises.set(d.devise, l);
  }

  /* Flux des réceptions sur les douze derniers mois, mois vides compris. */
  const parMois: LigneMois[] = [];
  const curseur = parseISODate(aujourdHui);
  curseur.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const m = new Date(curseur.getFullYear(), curseur.getMonth() - i, 1);
    const cle = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    parMois.push({
      mois: cle,
      libelle: `${MOIS_COURTS[m.getMonth()]} ${String(m.getFullYear()).slice(2)}`,
      nombre: calc.filter((x) => x.d.dateReception.startsWith(cle)).length,
    });
  }

  const toutesPieces = calc.flatMap((x) => x.d.pieces);
  const complets = calc.filter((x) => x.d.pieces.length > 0 && x.d.pieces.every((p) => p.fourni)).length;

  return {
    genereLe: new Date(),
    perimetre,
    total: calc.length,
    enCours: enCours.length,
    clos: calc.length - enCours.length,
    parNiveau: (Object.keys(NIVEAU_LABELS) as Niveau[]).map((cle) => {
      const nombre = enCours.filter((x) => x.c.niveau === cle).length;
      return { cle, libelle: NIVEAU_LABELS[cle], nombre, part: part(nombre, enCours.length) };
    }),
    parStatut: (Object.keys(STATUT_LABELS) as Statut[]).map((cle) => {
      const nombre = calc.filter((x) => x.d.statut === cle).length;
      return { cle, libelle: STATUT_LABELS[cle], nombre, part: part(nombre, calc.length) };
    }),
    parType,
    parAnalyste,
    parDevise: [...devises.values()].sort((a, b) => b.nombre - a.nombre),
    parMois,
    delaiMoyen: moyenne(restants),
    delaiMedian: mediane(restants),
    delaiMin: restants.length ? Math.min(...restants) : null,
    tauxRespect: enCours.length ? part(restants.filter((r) => r >= 0).length, enCours.length) : null,
    completude: toutesPieces.length ? part(toutesPieces.filter((p) => p.fourni).length, toutesPieces.length) : null,
    dossiersComplets: complets,
    piecesManquantes: toutesPieces.filter((p) => !p.fourni).length,
    nonAttribues: enCours.filter((x) => x.d.analyste === null).length,
    ancienneteMax: enCours.length ? Math.max(...enCours.map((x) => diffDays(x.d.dateReception, aujourdHui))) : null,
  };
}
