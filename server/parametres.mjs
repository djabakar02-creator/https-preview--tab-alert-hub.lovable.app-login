/**
 * Délais réglementaires par défaut, éditables par l'administrateur et
 * persistés à l'image du registre (server/registre.mjs).
 *
 * Un délai par défaut ne s'applique qu'aux dossiers créés APRÈS sa
 * modification : chaque dossier porte son propre `delaiReglementaire`, figé à
 * l'enregistrement (server/registre.mjs), de sorte qu'un changement de
 * politique ne réécrit jamais l'échéance d'un dossier déjà instruit ou clos.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DELAIS, TYPE_LABELS } from "../shared/dossiers-modele.mjs";
import { ErreurRequete } from "./ora.mjs";

const TYPES = Object.keys(TYPE_LABELS);

export function creerParametres(chemin) {
  const fichier = resolve(chemin);
  /** @type {Record<string, {jours: number, ouvres: boolean, source: string}> | null} */
  let delais = null;
  let historique = [];

  function charger() {
    if (delais) return delais;
    try {
      if (existsSync(fichier)) {
        const lu = JSON.parse(readFileSync(fichier, "utf8"));
        if (lu && typeof lu.delais === "object") {
          /* Un type ajouté au catalogue depuis la dernière écriture hérite de
             sa valeur du modèle partagé, sans attendre une purge du fichier. */
          delais = { ...DELAIS, ...lu.delais };
          historique = Array.isArray(lu.historique) ? lu.historique : [];
          return delais;
        }
      }
    } catch (e) {
      throw new Error(`Paramètres illisibles (${fichier}) : ${e.message}`);
    }
    delais = { ...DELAIS };
    historique = [];
    return delais;
  }

  function ecrire() {
    mkdirSync(dirname(fichier), { recursive: true });
    const tmp = `${fichier}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ delais, historique: historique.slice(-500) }, null, 2), "utf8");
    renameSync(tmp, fichier);
  }

  function journaliser(auteur, action) {
    historique.push({ date: new Date().toISOString(), auteur, action });
  }

  return {
    delais() {
      return charger();
    },

    historique() {
      charger();
      return [...historique].reverse().slice(0, 100);
    },

    modifierDelai(acteur, type, { jours, ouvres }) {
      if (acteur?.role !== "admin") throw new ErreurRequete("Seul un administrateur définit les délais réglementaires.", 403);
      if (!TYPES.includes(type)) throw new ErreurRequete("Type d'opération inconnu.");
      const j = Number(jours);
      if (!Number.isInteger(j) || j <= 0 || j > 3650) throw new ErreurRequete("Le délai doit être un nombre entier de jours, entre 1 et 3650.");
      charger();
      /* Un délai posé ici l'est délibérément par le service : il ne porte plus
         la réserve « valeur de travail » d'un défaut jamais confirmé. */
      delais[type] = { jours: j, ouvres: Boolean(ouvres), source: "parametre" };
      journaliser(acteur.username, `Délai réglementaire « ${TYPE_LABELS[type]} » fixé à ${j} jour(s)${ouvres ? " ouvrés" : ""}`);
      ecrire();
      return delais[type];
    },
  };
}
