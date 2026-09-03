const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Date ISO (YYYY-MM-DD) locale, sans composante horaire. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Le jour est-il ouvré ? Samedi et dimanche exclus. */
export function estJourOuvre(iso: string): boolean {
  const j = parseISODate(iso).getDay();
  return j !== 0 && j !== 6;
}

/**
 * Jours ouvrés entre deux dates ISO (b - a), samedi et dimanche exclus.
 *
 * Les jours fériés ne sont pas décomptés : leur calendrier n'est pas fourni.
 * Le décompte peut donc être légèrement optimiste autour d'un jour férié.
 */
export function diffJoursOuvres(a: string, b: string): number {
  const debut = parseISODate(a);
  const fin = parseISODate(b);
  const sens = fin >= debut ? 1 : -1;
  let n = 0;
  const curseur = new Date(debut);
  while (sens > 0 ? curseur < fin : curseur > fin) {
    curseur.setDate(curseur.getDate() + sens);
    if (estJourOuvre(toISODate(curseur))) n += sens;
  }
  return n;
}

/** Ajoute un nombre de jours ouvrés à une date ISO. */
export function addJoursOuvres(iso: string, jours: number): string {
  const d = parseISODate(iso);
  let restants = Math.abs(jours);
  const sens = jours < 0 ? -1 : 1;
  while (restants > 0) {
    d.setDate(d.getDate() + sens);
    if (estJourOuvre(toISODate(d))) restants -= 1;
  }
  return toISODate(d);
}

/** Nombre de jours calendaires entiers entre deux dates ISO (b - a). */
export function diffDays(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatDateFR(iso: string): string {
  const d = parseISODate(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatLongDateFR(d: Date): string {
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatEdition(d: Date): string {
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function formatClock(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`;
}

export function formatDateTimeFR(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Nombre à la française. `toLocaleString` groupe avec une espace fine
 * insécable (U+202F), presque invisible à petite taille : sur des montants de
 * banque centrale, on lui préfère l'espace insécable ordinaire.
 */
export function formatNombreFR(n: number): string {
  return n.toLocaleString("fr-FR").replace(/\u202F/g, "\u00A0");
}
