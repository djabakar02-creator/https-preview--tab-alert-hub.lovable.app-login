/**
 * Annuaire des comptes : persisté dans un fichier JSON, à l'image du registre
 * des dossiers (server/registre.mjs). Remplace l'annuaire de démonstration
 * figé en mémoire par un annuaire que l'administrateur gère depuis l'onglet
 * Paramètres — reste néanmoins un jeu de comptes locaux à l'application, à
 * remplacer par l'annuaire de la Banque (LDAP, Active Directory) avant tout
 * usage réel.
 *
 * Charte des attributions (voir Paramètres) appliquée ici, pas seulement
 * suggérée côté client :
 * - seul un administrateur crée, modifie ou supprime un compte ;
 * - il reste toujours au moins un compte administrateur ;
 * - un administrateur ne peut pas supprimer son propre compte ;
 * - un mot de passe compte au moins huit caractères ;
 * - toute modification est journalisée (date, auteur, action).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import { ErreurRequete } from "./ora.mjs";

export const ROLES = ["admin", "hierarchie", "analyste", "lecture"];
export const ROLE_LABELS = {
  admin: "Administrateur",
  hierarchie: "Chef de service",
  analyste: "Agent traitant",
  lecture: "Consultation",
};

const IDENTIFIANT = /^[a-z0-9._-]{3,32}$/;

function hacher(motDePasse, sel) {
  return scryptSync(motDePasse, sel, 32).toString("hex");
}

function nouveauCompte(username, motDePasse, displayName, role) {
  const sel = randomBytes(16).toString("hex");
  return { username, displayName, role, sel, condensat: hacher(motDePasse, sel) };
}

function seed() {
  return [
    nouveauCompte("admin", "admin123", "Administrateur", "admin"),
    nouveauCompte("analyste", "analyste123", "Agent traitant", "analyste"),
    nouveauCompte("hierarchie", "hier123", "Chef de service", "hierarchie"),
    nouveauCompte("lecture", "lecture123", "Consultation", "lecture"),
  ];
}

const public_ = ({ username, displayName, role }) => ({ username, displayName, role });

export function creerAnnuaire(chemin) {
  const fichier = resolve(chemin);
  /** @type {Map<string, object> | null} */
  let comptes = null;
  let historique = [];

  function charger() {
    if (comptes) return comptes;
    try {
      if (existsSync(fichier)) {
        const lu = JSON.parse(readFileSync(fichier, "utf8"));
        if (Array.isArray(lu?.comptes)) {
          comptes = new Map(lu.comptes.map((c) => [c.username, c]));
          historique = Array.isArray(lu.historique) ? lu.historique : [];
          return comptes;
        }
      }
    } catch (e) {
      throw new Error(`Annuaire illisible (${fichier}) : ${e.message}`);
    }
    comptes = new Map(seed().map((c) => [c.username, c]));
    historique = [{ date: new Date().toISOString(), auteur: "système", action: "Annuaire de démonstration initialisé" }];
    ecrire();
    return comptes;
  }

  function ecrire() {
    mkdirSync(dirname(fichier), { recursive: true });
    const tmp = `${fichier}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ comptes: [...comptes.values()], historique: historique.slice(-500) }, null, 2), "utf8");
    renameSync(tmp, fichier);
  }

  function journaliser(auteur, action) {
    historique.push({ date: new Date().toISOString(), auteur, action });
  }

  function nbAdmins() {
    return [...charger().values()].filter((c) => c.role === "admin").length;
  }

  function exigerAdmin(acteur) {
    if (acteur?.role !== "admin") throw new ErreurRequete("Seul un administrateur gère les comptes.", 403);
  }

  return {
    /** Map brute {username → compte, condensat compris} : réservée à l'authentification. */
    map() {
      return charger();
    },

    /** Comptes sans les secrets : ce que le client peut voir. */
    lister() {
      return [...charger().values()].map(public_);
    },

    historique() {
      charger();
      return [...historique].reverse().slice(0, 100);
    },

    creer(acteur, { username, displayName, role, motDePasse }) {
      exigerAdmin(acteur);
      const u = String(username ?? "").trim().toLowerCase();
      if (!IDENTIFIANT.test(u))
        throw new ErreurRequete("Identifiant invalide : 3 à 32 caractères (lettres minuscules, chiffres, points, tirets).");
      charger();
      if (comptes.has(u)) throw new ErreurRequete(`L'identifiant « ${u} » est déjà attribué.`);
      if (!ROLES.includes(role)) throw new ErreurRequete("Rôle inconnu.");
      const nom = String(displayName ?? "").trim();
      if (!nom) throw new ErreurRequete("Le nom affiché est obligatoire.");
      if (String(motDePasse ?? "").length < 8) throw new ErreurRequete("Le mot de passe doit compter au moins 8 caractères.");
      comptes.set(u, nouveauCompte(u, motDePasse, nom, role));
      journaliser(acteur.username, `Création du compte ${u} (${ROLE_LABELS[role]})`);
      ecrire();
      return public_(comptes.get(u));
    },

    modifier(acteur, username, { displayName, role, motDePasse }) {
      exigerAdmin(acteur);
      const u = String(username ?? "").trim().toLowerCase();
      charger();
      const c = comptes.get(u);
      if (!c) throw new ErreurRequete("Compte introuvable.", 404);

      if (role !== undefined && role !== c.role) {
        if (!ROLES.includes(role)) throw new ErreurRequete("Rôle inconnu.");
        if (c.role === "admin" && nbAdmins() <= 1)
          throw new ErreurRequete("Impossible : ce compte est le dernier administrateur restant.");
        c.role = role;
        journaliser(acteur.username, `Rôle de ${u} changé en ${ROLE_LABELS[role]}`);
      }
      if (displayName !== undefined) {
        const nom = String(displayName).trim();
        if (!nom) throw new ErreurRequete("Le nom affiché est obligatoire.");
        if (nom !== c.displayName) {
          c.displayName = nom;
          journaliser(acteur.username, `Nom affiché de ${u} modifié`);
        }
      }
      if (motDePasse) {
        if (String(motDePasse).length < 8) throw new ErreurRequete("Le mot de passe doit compter au moins 8 caractères.");
        c.sel = randomBytes(16).toString("hex");
        c.condensat = hacher(motDePasse, c.sel);
        journaliser(acteur.username, `Mot de passe de ${u} réinitialisé`);
      }
      ecrire();
      return public_(c);
    },

    supprimer(acteur, username) {
      exigerAdmin(acteur);
      const u = String(username ?? "").trim().toLowerCase();
      charger();
      const c = comptes.get(u);
      if (!c) throw new ErreurRequete("Compte introuvable.", 404);
      if (u === String(acteur.username ?? "").trim().toLowerCase())
        throw new ErreurRequete("Vous ne pouvez pas supprimer votre propre compte.");
      if (c.role === "admin" && nbAdmins() <= 1) throw new ErreurRequete("Impossible de supprimer le dernier administrateur.");
      comptes.delete(u);
      journaliser(acteur.username, `Suppression du compte ${u}`);
      ecrire();
    },
  };
}
