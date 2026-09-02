/**
 * Registre partagé : les dossiers vivent ici, pas dans le navigateur de chaque
 * agent. Écriture atomique dans un fichier JSON, ce qui suffit largement au
 * volume d'un service et évite d'imposer une base de données.
 *
 * Les permissions sont vérifiées ici, à l'écriture. L'interface masque les
 * boutons interdits, mais c'est ce contrôle-ci qui protège réellement.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { donneesInitiales, PERMISSIONS, refusEcriture } from "../shared/dossiers-modele.mjs";
import { ErreurRequete } from "./ora.mjs";

const CHAMPS = [
  "id",
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
  "historique",
  "version",
];

/** Ne conserve que les champs connus : le client ne décide pas du schéma. */
function nettoyer(d) {
  if (!d || typeof d !== "object") throw new ErreurRequete("Dossier illisible.");
  const out = {};
  for (const k of CHAMPS) if (k in d) out[k] = d[k];
  if (typeof out.id !== "string" || !out.id) throw new ErreurRequete("Identifiant de dossier manquant.");
  if (typeof out.reference !== "string" || !out.reference.trim()) throw new ErreurRequete("La référence est obligatoire.");
  if (typeof out.demandeur !== "string" || !out.demandeur.trim()) throw new ErreurRequete("Le demandeur est obligatoire.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.dateReception ?? "")) throw new ErreurRequete("Date de réception invalide.");
  if (!(Number(out.delaiReglementaire) > 0)) throw new ErreurRequete("Délai réglementaire invalide.");
  out.montant = Number(out.montant) || 0;
  out.analyste = out.analyste ?? null;
  out.pieces = Array.isArray(out.pieces) ? out.pieces.map((p) => ({ label: String(p?.label ?? ""), fourni: Boolean(p?.fourni) })) : [];
  out.historique = Array.isArray(out.historique) ? out.historique.slice(-200) : [];
  out.observations = String(out.observations ?? "");
  return out;
}

export function creerRegistre(chemin) {
  const fichier = resolve(chemin);
  let dossiers = null;

  function charger() {
    if (dossiers) return dossiers;
    try {
      if (existsSync(fichier)) {
        const lu = JSON.parse(readFileSync(fichier, "utf8"));
        if (Array.isArray(lu)) return (dossiers = lu);
      }
    } catch (e) {
      /* Un fichier illisible ne doit pas être écrasé en silence. */
      throw new Error(`Registre illisible (${fichier}) : ${e.message}`);
    }
    dossiers = donneesInitiales();
    ecrire();
    return dossiers;
  }

  function ecrire() {
    mkdirSync(dirname(fichier), { recursive: true });
    /* Écriture atomique : un fichier temporaire puis un renommage, pour qu'une
       coupure ne laisse jamais un registre à moitié écrit. */
    const tmp = `${fichier}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(dossiers, null, 2), "utf8");
    renameSync(tmp, fichier);
  }

  function journaliser(d, auteur, action) {
    return { ...d, historique: [...(d.historique ?? []), { date: new Date().toISOString(), auteur, action }] };
  }

  return {
    lister() {
      return charger();
    },

    /**
     * Crée ou remplace un dossier. `version` porte le contrôle de concurrence :
     * deux agents qui modifient le même dossier ne s'écrasent pas en silence.
     */
    enregistrer(utilisateur, entrant) {
      const liste = charger();
      const propre = nettoyer(entrant);
      const i = liste.findIndex((d) => d.id === propre.id);
      const avant = i === -1 ? null : liste[i];

      const refus = refusEcriture(utilisateur, avant, propre);
      if (refus) throw new ErreurRequete(refus, 403);

      if (avant && typeof propre.version === "number" && typeof avant.version === "number" && propre.version !== avant.version) {
        throw new ErreurRequete(
          "Ce dossier a été modifié par un autre agent pendant votre saisie. Rechargez le registre avant d'enregistrer.",
          409,
        );
      }

      const suivant = journaliser(
        { ...propre, version: (avant?.version ?? 0) + 1 },
        utilisateur.username,
        avant ? "Modification du dossier" : "Enregistrement du dossier au registre",
      );
      if (i === -1) liste.unshift(suivant);
      else liste[i] = suivant;
      ecrire();
      return suivant;
    },

    supprimer(utilisateur, id) {
      const liste = charger();
      const i = liste.findIndex((d) => d.id === id);
      if (i === -1) throw new ErreurRequete("Dossier introuvable.", 404);
      if (!PERMISSIONS.supprimer(utilisateur, liste[i]))
        throw new ErreurRequete("Ce dossier est attribué à un autre analyste : vous ne pouvez pas le supprimer.", 403);
      liste.splice(i, 1);
      ecrire();
    },

    /** Remplace tout le registre : réservé à l'administrateur (import, remise à zéro). */
    remplacer(utilisateur, entrants) {
      if (!PERMISSIONS.importer(utilisateur)) throw new ErreurRequete("Seul un administrateur peut remplacer le registre.", 403);
      if (!Array.isArray(entrants)) throw new ErreurRequete("Liste de dossiers attendue.");
      if (entrants.length > 5000) throw new ErreurRequete("Import trop volumineux.");
      dossiers = entrants.map((d) => ({ ...nettoyer(d), version: 1 }));
      ecrire();
      return dossiers;
    },

    reinitialiser(utilisateur) {
      if (!PERMISSIONS.importer(utilisateur)) throw new ErreurRequete("Seul un administrateur peut réinitialiser le registre.", 403);
      dossiers = donneesInitiales();
      ecrire();
      return dossiers;
    },
  };
}
