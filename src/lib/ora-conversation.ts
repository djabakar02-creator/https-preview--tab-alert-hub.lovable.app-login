import { useSyncExternalStore } from "react";
import type { Dossier } from "./dossiers";
import { demanderOra, type OraMessage } from "./ora";

/**
 * Conversation avec Ora, partagée entre la bulle flottante (visible partout)
 * et la page dédiée (/ora) : c'est la même assistante, pas deux instances qui
 * s'ignorent. Store réactif au même principe que src/lib/dossiers.ts.
 */

interface Etat {
  dossierId: string;
  messages: OraMessage[];
  partiel: string;
  enCours: boolean;
  /** Bulle flottante dépliée ou repliée. Sans effet sur la page dédiée, toujours dépliée. */
  ouvert: boolean;
}

let etat: Etat = { dossierId: "", messages: [], partiel: "", enCours: false, ouvert: false };
let abort: AbortController | null = null;
const listeners = new Set<() => void>();

function notifier() {
  listeners.forEach((l) => l());
}

function poser(patch: Partial<Etat>) {
  etat = { ...etat, ...patch };
  notifier();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useOraConversation(): Etat {
  return useSyncExternalStore(subscribe, () => etat, () => etat);
}

/** Lecture ponctuelle hors composant React (tests, diagnostics). */
export function obtenirEtatOra(): Etat {
  return etat;
}

export function definirDossierOra(id: string) {
  poser({ dossierId: id });
}

export function ouvrirOra() {
  poser({ ouvert: true });
}
export function fermerOra() {
  poser({ ouvert: false });
}
export function basculerOra() {
  poser({ ouvert: !etat.ouvert });
}

export function nouvelleConversationOra() {
  poser({ messages: [], partiel: "" });
}

export function interrompreOra() {
  abort?.abort();
}

export async function envoyerOra(texte: string, dossier: Dossier | null, timeoutMs?: number) {
  const q = texte.trim();
  if (!q || etat.enCours) return;
  const historique = etat.messages;
  poser({ messages: [...historique, { role: "user", content: q }], partiel: "", enCours: true });
  abort = new AbortController();
  try {
    const rep = await demanderOra(q, dossier, historique, {
      signal: abort.signal,
      onText: (t) => poser({ partiel: t }),
      timeoutMs,
    });
    poser({ messages: [...etat.messages, rep] });
  } catch (err) {
    const e = err as { name?: string; code?: string; message?: string };
    if (e.name !== "AbortError" && e.code !== "cancelled") {
      poser({
        messages: [
          ...etat.messages,
          { role: "ora", content: `Je n'ai pas pu traiter votre demande : ${e.message ?? "erreur inconnue"}.`, moteur: "local" },
        ],
      });
    }
  } finally {
    poser({ partiel: "", enCours: false });
  }
}
