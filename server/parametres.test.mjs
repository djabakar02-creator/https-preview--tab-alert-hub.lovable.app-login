import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { creerParametres } from "./parametres.mjs";
import { DELAIS } from "../shared/dossiers-modele.mjs";

const ADMIN = { username: "admin", role: "admin" };
const HIER = { username: "hierarchie", role: "hierarchie" };

let dossier;
let params;

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), "params-"));
  params = creerParametres(join(dossier, "parametres.json"));
});
afterEach(() => rmSync(dossier, { recursive: true, force: true }));

describe("paramètres — délais", () => {
  it("démarre sur les délais du catalogue partagé", () => {
    expect(params.delais()).toEqual(DELAIS);
  });

  it("refuse la modification à qui n'est pas administrateur", () => {
    expect(() => params.modifierDelai(HIER, "immobilier_hors_cemac", { jours: 45 })).toThrow(/administrateur/);
  });

  it("refuse un type inconnu ou un délai invalide", () => {
    expect(() => params.modifierDelai(ADMIN, "type_fantome", { jours: 30 })).toThrow(/[Tt]ype/);
    expect(() => params.modifierDelai(ADMIN, "immobilier_hors_cemac", { jours: 0 })).toThrow();
    expect(() => params.modifierDelai(ADMIN, "immobilier_hors_cemac", { jours: -5 })).toThrow();
    expect(() => params.modifierDelai(ADMIN, "immobilier_hors_cemac", { jours: 1.5 })).toThrow();
  });

  it("fixe un délai et marque sa source comme paramétrée par le service", () => {
    params.modifierDelai(ADMIN, "immobilier_hors_cemac", { jours: 45, ouvres: false });
    expect(params.delais().immobilier_hors_cemac).toEqual({ jours: 45, ouvres: false, source: "parametre" });
  });

  it("ne modifie que le type visé, laissant les autres au catalogue", () => {
    params.modifierDelai(ADMIN, "immobilier_hors_cemac", { jours: 45 });
    expect(params.delais().pret_non_resident).toEqual(DELAIS.pret_non_resident);
  });

  it("journalise chaque modification", () => {
    params.modifierDelai(ADMIN, "immobilier_hors_cemac", { jours: 45 });
    expect(params.historique()[0].action).toMatch(/45 jour/);
    expect(params.historique()[0].auteur).toBe("admin");
  });

  it("un second magasin relit le fichier au lieu de revenir au catalogue", () => {
    params.modifierDelai(ADMIN, "immobilier_hors_cemac", { jours: 45 });
    const autre = creerParametres(join(dossier, "parametres.json"));
    expect(autre.delais().immobilier_hors_cemac.jours).toBe(45);
  });
});
