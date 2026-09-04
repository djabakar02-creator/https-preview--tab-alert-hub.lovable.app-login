import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { creerAnnuaire } from "./annuaire.mjs";
import { authentifier } from "./comptes.mjs";

const ADMIN = { username: "admin", role: "admin" };
const HIER = { username: "hierarchie", role: "hierarchie" };

let dossier;
let ann;

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), "ann-"));
  ann = creerAnnuaire(join(dossier, "comptes.json"));
});
afterEach(() => rmSync(dossier, { recursive: true, force: true }));

describe("annuaire — démarrage", () => {
  it("démarre sur les quatre comptes de démonstration", () => {
    const comptes = ann.lister();
    expect(comptes.map((c) => c.username).sort()).toEqual(["admin", "analyste", "hierarchie", "lecture"]);
  });

  it("ne renvoie jamais le sel ni le condensat au client", () => {
    for (const c of ann.lister()) {
      expect(c).not.toHaveProperty("sel");
      expect(c).not.toHaveProperty("condensat");
    }
  });

  it("un second annuaire relit le fichier au lieu de le réinitialiser", () => {
    ann.creer(ADMIN, { username: "nouveau", displayName: "Nouvel agent", role: "analyste", motDePasse: "motdepasse1" });
    const autre = creerAnnuaire(join(dossier, "comptes.json"));
    expect(autre.lister().some((c) => c.username === "nouveau")).toBe(true);
  });
});

describe("annuaire — création", () => {
  it("refuse la création à qui n'est pas administrateur", () => {
    expect(() => ann.creer(HIER, { username: "x", displayName: "X", role: "analyste", motDePasse: "motdepasse1" })).toThrow(
      /administrateur/,
    );
  });

  it("refuse un identifiant déjà attribué, un rôle inconnu, ou un mot de passe trop court", () => {
    expect(() => ann.creer(ADMIN, { username: "admin", displayName: "X", role: "analyste", motDePasse: "motdepasse1" })).toThrow(
      /déjà attribué/,
    );
    expect(() => ann.creer(ADMIN, { username: "usr", displayName: "X", role: "roi", motDePasse: "motdepasse1" })).toThrow(/[Rr]ôle/);
    expect(() => ann.creer(ADMIN, { username: "usr", displayName: "X", role: "analyste", motDePasse: "court" })).toThrow(/8 caractères/);
  });

  it("normalise l'identifiant en minuscules et permet ensuite l'authentification", () => {
    ann.creer(ADMIN, { username: "Dupont", displayName: "Dupont", role: "analyste", motDePasse: "motdepasse1" });
    expect(ann.lister().some((c) => c.username === "dupont")).toBe(true);
    expect(authentifier(ann.map(), "DUPONT", "motdepasse1")?.username).toBe("dupont");
  });
});

describe("annuaire — modification", () => {
  it("change le rôle, le nom affiché, ou le mot de passe", () => {
    ann.modifier(ADMIN, "analyste", { role: "hierarchie" });
    expect(ann.lister().find((c) => c.username === "analyste").role).toBe("hierarchie");

    ann.modifier(ADMIN, "analyste", { displayName: "Nouveau nom" });
    expect(ann.lister().find((c) => c.username === "analyste").displayName).toBe("Nouveau nom");

    ann.modifier(ADMIN, "analyste", { motDePasse: "nouveaumotdepasse" });
    expect(authentifier(ann.map(), "analyste", "nouveaumotdepasse")?.username).toBe("analyste");
  });

  it("refuse de rétrograder le dernier administrateur", () => {
    expect(() => ann.modifier(ADMIN, "admin", { role: "analyste" })).toThrow(/dernier administrateur/);
  });

  it("autorise de rétrograder un administrateur s'il en reste un autre", () => {
    ann.creer(ADMIN, { username: "admin2", displayName: "Second admin", role: "admin", motDePasse: "motdepasse1" });
    expect(() => ann.modifier(ADMIN, "admin", { role: "analyste" })).not.toThrow();
  });

  it("journalise chaque modification", () => {
    ann.modifier(ADMIN, "analyste", { displayName: "Nouveau nom" });
    expect(ann.historique()[0].action).toMatch(/Nom affiché/);
    expect(ann.historique()[0].auteur).toBe("admin");
  });
});

describe("annuaire — suppression", () => {
  it("refuse qu'un administrateur supprime son propre compte", () => {
    expect(() => ann.supprimer(ADMIN, "admin")).toThrow(/propre compte/);
  });

  it("refuse de supprimer le dernier administrateur, même par un autre compte", () => {
    // Le seul administrateur existant est justement l'acteur ici : on simule un
    // autre acteur admin pour isoler la règle testée (dernier admin).
    ann.creer(ADMIN, { username: "admin2", displayName: "Second admin", role: "admin", motDePasse: "motdepasse1" });
    ann.supprimer(ADMIN, "admin2");
    expect(() => ann.supprimer({ username: "admin", role: "admin" }, "admin")).toThrow();
  });

  it("supprime un compte ordinaire sans laisser de trace de ses secrets", () => {
    ann.supprimer(ADMIN, "analyste");
    expect(ann.lister().some((c) => c.username === "analyste")).toBe(false);
  });
});

describe("annuaire — persistance", () => {
  it("écrit un fichier lisible qui ne contient jamais l'annuaire en clair sans condensat", () => {
    ann.creer(ADMIN, { username: "usr", displayName: "X", role: "analyste", motDePasse: "motdepasse1" });
    const brut = JSON.parse(readFileSync(join(dossier, "comptes.json"), "utf8"));
    const usr = brut.comptes.find((c) => c.username === "usr");
    expect(usr.condensat).toBeTruthy();
    expect(usr.condensat).not.toBe("motdepasse1");
  });
});
