import { describe, expect, it } from "vitest";
import { calculerDelai, delaiDuDossier, niveauPour } from "./delais";
import { DELAIS, SOUS_TYPES, TYPE_COURT, TYPE_LABELS } from "./dossiers";

describe("calculerDelai", () => {
  it("dérive le délai de la date du jour et de la date de réception", () => {
    const r = calculerDelai("2026-08-14", 30, "2026-09-02");
    expect(r.joursEcoules).toBe(19);
    expect(r.echeance).toBe("2026-09-13");
    expect(r.delaiRestant).toBe(11);
    expect(r.niveau).toBe("conforme");
  });

  it("n'est pas statique : le même dossier change avec la date du jour", () => {
    const a = calculerDelai("2026-08-01", 30, "2026-08-10");
    const b = calculerDelai("2026-08-01", 30, "2026-08-29");
    expect(a.delaiRestant).toBe(21);
    expect(b.delaiRestant).toBe(2);
    expect(b.niveau).toBe("urgent");
  });

  it("signale le dépassement", () => {
    expect(calculerDelai("2026-07-01", 30, "2026-09-02").niveau).toBe("depasse");
  });
});

describe("niveauPour", () => {
  it("classe les seuils", () => {
    expect(niveauPour(11)).toBe("conforme");
    expect(niveauPour(10)).toBe("a_suivre");
    expect(niveauPour(3)).toBe("urgent");
    expect(niveauPour(0)).toBe("urgent");
    expect(niveauPour(-1)).toBe("depasse");
  });
});

describe("délais en jours ouvrés", () => {
  /* Le catalogue du service impose 60 jours ouvrés pour les investissements de
     portefeuille sortants : le décompte ne peut pas être calendaire. */
  it("ne compte ni le samedi ni le dimanche", () => {
    // Du lundi 31/08/2026 au lundi 07/09/2026 : 7 jours calendaires, 5 ouvrés.
    expect(calculerDelai("2026-08-31", 60, "2026-09-07", false).joursEcoules).toBe(7);
    expect(calculerDelai("2026-08-31", 60, "2026-09-07", true).joursEcoules).toBe(5);
  });

  it("repousse l'échéance au-delà des fins de semaine", () => {
    // 5 jours ouvrés depuis le lundi 31/08 tombent le lundi 07/09.
    expect(calculerDelai("2026-08-31", 5, "2026-08-31", true).echeance).toBe("2026-09-07");
    expect(calculerDelai("2026-08-31", 5, "2026-08-31", false).echeance).toBe("2026-09-05");
  });

  it("indique le mode de décompte retenu", () => {
    expect(calculerDelai("2026-08-31", 30, "2026-09-07", true).ouvres).toBe(true);
    expect(calculerDelai("2026-08-31", 30, "2026-09-07").ouvres).toBe(false);
  });

  it("applique les jours ouvrés au seul type qui les impose", () => {
    const base = { dateReception: "2026-08-31", delaiReglementaire: 60 };
    expect(delaiDuDossier({ ...base, type: "portefeuille_sortant" }, "2026-09-07").joursEcoules).toBe(5);
    expect(delaiDuDossier({ ...base, type: "immobilier_hors_cemac" }, "2026-09-07").joursEcoules).toBe(7);
  });
});

describe("catalogue des opérations", () => {
  it("porte les neuf types du service, avec leurs sous-catégories", () => {
    expect(Object.keys(TYPE_LABELS)).toHaveLength(9);
    expect(SOUS_TYPES.valeurs_mobilieres).toHaveLength(2);
    expect(SOUS_TYPES.bureau_de_change).toHaveLength(4);
    expect(SOUS_TYPES.immobilier_hors_cemac).toBeUndefined();
  });

  it("distingue un délai du catalogue d'une valeur de travail", () => {
    expect(DELAIS.portefeuille_sortant).toEqual({ jours: 60, ouvres: true, source: "catalogue" });
    const aConfirmer = Object.values(DELAIS).filter((d) => d.source === "defaut");
    expect(aConfirmer).toHaveLength(7);
  });

  it("reprend le délai d'une instruction publiée, avec sa référence", () => {
    // Instruction n° 001/GR/2019, art. 4 : 30 jours ouvrés, silence de la
    // Banque centrale passé ce délai vaut acceptation.
    expect(DELAIS.import_billets).toEqual({
      jours: 30,
      ouvres: true,
      source: "instruction",
      reference: "Instruction n° 001/GR/2019 du 10 juin 2019, art. 4",
    });
  });

  it("donne un intitulé court à chaque type", () => {
    for (const t of Object.keys(TYPE_LABELS)) {
      expect(TYPE_COURT[t as keyof typeof TYPE_COURT].length).toBeGreaterThan(0);
      expect(TYPE_COURT[t as keyof typeof TYPE_COURT].length).toBeLessThan(45);
    }
  });
});
