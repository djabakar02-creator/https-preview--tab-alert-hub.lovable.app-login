import { describe, expect, it } from "vitest";
import { construireRapport } from "./rapport";
import { piecesRequises, type Dossier, type Statut } from "./dossiers";
import { addDays, toISODate } from "./dates";

const AUJ = "2026-09-02";

function d(over: Partial<Dossier> = {}): Dossier {
  return {
    id: Math.random().toString(36).slice(2),
    reference: "DRC/SA/2026/0001",
    demandeur: "Demandeur",
    type: "immobilier_hors_cemac",
    montant: 0,
    devise: "XAF",
    dateReception: addDays(AUJ, -10),
    delaiReglementaire: 30,
    analyste: "analyste",
    statut: "en_instruction",
    pieces: piecesRequises("immobilier_hors_cemac"),
    observations: "",
    historique: [],
    ...over,
  };
}

describe("construireRapport — comptages", () => {
  it("sépare les dossiers en cours des dossiers clos", () => {
    const r = construireRapport([d(), d({ statut: "valide" }), d({ statut: "rejete" })], "T", AUJ);
    expect(r.total).toBe(3);
    expect(r.enCours).toBe(1);
    expect(r.clos).toBe(2);
  });

  it("ne compte les niveaux de délai que sur les dossiers en cours", () => {
    /* Un dossier clos n'a plus de délai à respecter : il ne doit pas peser
       sur la répartition par niveau. */
    const r = construireRapport([d({ dateReception: addDays(AUJ, -40), statut: "valide" }), d()], "T", AUJ);
    expect(r.parNiveau.find((n) => n.cle === "depasse")?.nombre).toBe(0);
    expect(r.parNiveau.reduce((a, b) => a + b.nombre, 0)).toBe(1);
  });

  it("rend des parts qui totalisent cent pour cent", () => {
    const r = construireRapport([d(), d({ statut: "valide" })], "T", AUJ);
    expect(r.parStatut.reduce((a, b) => a + b.part, 0)).toBe(100);
  });
});

describe("construireRapport — délais", () => {
  it("calcule moyenne, médiane et minimum sur les dossiers en cours", () => {
    const jours = [5, 10, 30];
    const r = construireRapport(
      jours.map((j) => d({ dateReception: addDays(AUJ, -(30 - j)) })),
      "T",
      AUJ,
    );
    expect(r.delaiMin).toBe(5);
    expect(r.delaiMedian).toBe(10);
    expect(r.delaiMoyen).toBe(15);
  });

  it("mesure le respect des échéances", () => {
    const r = construireRapport([d(), d(), d({ dateReception: addDays(AUJ, -40) })], "T", AUJ);
    expect(r.tauxRespect).toBe(67);
  });

  it("relève l'ancienneté du plus ancien dossier en cours", () => {
    const r = construireRapport([d({ dateReception: addDays(AUJ, -64) }), d()], "T", AUJ);
    expect(r.ancienneteMax).toBe(64);
  });

  it("ne divise pas par zéro sur un registre vide", () => {
    const r = construireRapport([], "T", AUJ);
    expect(r.delaiMoyen).toBeNull();
    expect(r.tauxRespect).toBeNull();
    expect(r.completude).toBeNull();
    expect(r.ancienneteMax).toBeNull();
    expect(r.parType).toEqual([]);
  });
});

describe("construireRapport — pièces", () => {
  it("mesure la complétude et compte les pièces manquantes", () => {
    const requises = piecesRequises("immobilier_hors_cemac");
    const complet = d({ pieces: requises.map((p) => ({ ...p, fourni: true })) });
    const partiel = d({ pieces: requises.map((p, i) => ({ ...p, fourni: i === 0 })) });
    const r = construireRapport([complet, partiel], "T", AUJ);
    const total = requises.length * 2;
    expect(r.dossiersComplets).toBe(1);
    expect(r.piecesManquantes).toBe(requises.length - 1);
    expect(r.completude).toBe(Math.round(((requises.length + 1) / total) * 100));
  });
});

describe("construireRapport — ventilations", () => {
  it("détaille chaque type présent, et lui seul", () => {
    const r = construireRapport([d({ type: "immobilier_hors_cemac" }), d({ type: "pret_non_resident" })], "T", AUJ);
    expect(r.parType.map((l) => l.type).sort()).toEqual(["immobilier_hors_cemac", "pret_non_resident"]);
    expect(r.parType.every((l) => l.total > 0)).toBe(true);
  });

  it("place les dossiers non attribués en fin de liste des analystes", () => {
    const r = construireRapport([d({ analyste: null }), d({ analyste: "analyste" })], "T", AUJ);
    expect(r.parAnalyste[r.parAnalyste.length - 1].analyste).toBe("Non attribué");
    expect(r.nonAttribues).toBe(1);
  });

  it("agrège les montants par devise, en ignorant les montants absents", () => {
    const r = construireRapport(
      [d({ montant: 1000, devise: "XAF" }), d({ montant: 500, devise: "XAF" }), d({ montant: 0, devise: "EUR" })],
      "T",
      AUJ,
    );
    expect(r.parDevise).toEqual([{ devise: "XAF", nombre: 2, montant: 1500 }]);
  });

  it("couvre douze mois de réception, mois creux compris", () => {
    const r = construireRapport([d({ dateReception: "2026-09-01" })], "T", AUJ);
    expect(r.parMois).toHaveLength(12);
    expect(r.parMois[11].mois).toBe("2026-09");
    expect(r.parMois[11].nombre).toBe(1);
    expect(r.parMois[0].nombre).toBe(0);
  });
});

describe("construireRapport — performance par analyste", () => {
  const cloture = (auteur: string, action: string, joursApresReception: number, dateReception: string) => ({
    date: `${addDays(dateReception, joursApresReception)}T09:00:00.000Z`,
    auteur,
    action,
  });

  it("compte les dossiers clos séparément de la charge en cours", () => {
    const recu = addDays(AUJ, -40);
    const r = construireRapport(
      [
        d({ analyste: "analyste", statut: "en_instruction" }),
        d({ analyste: "analyste", statut: "valide", dateReception: recu, historique: [cloture("hierarchie", "Validation du dossier", 12, recu)] }),
        d({ analyste: "analyste", statut: "rejete", dateReception: recu, historique: [cloture("hierarchie", "Rejet du dossier", 20, recu)] }),
      ],
      "T",
      AUJ,
    );
    const ligne = r.parAnalyste.find((a) => a.analyste === "analyste")!;
    expect(ligne.enCours).toBe(1);
    expect(ligne.traites).toBe(2);
    expect(ligne.valides).toBe(1);
    expect(ligne.rejetes).toBe(1);
  });

  it("calcule le délai de traitement réception → clôture, pas réception → aujourd'hui", () => {
    const recu = addDays(AUJ, -200); // bien avant aujourd'hui : un calcul erroné le trahirait
    const r = construireRapport(
      [d({ analyste: "analyste", statut: "valide", dateReception: recu, historique: [cloture("hierarchie", "Validation du dossier", 18, recu)] })],
      "T",
      AUJ,
    );
    expect(r.parAnalyste[0].delaiTraitementMoyen).toBe(18);
  });

  it("mesure le respect du délai réglementaire au jour de la clôture", () => {
    const recu = addDays(AUJ, -60);
    const r = construireRapport(
      [
        // clos à J+12 sur un délai de 30 : dans les délais
        d({ analyste: "a", statut: "valide", delaiReglementaire: 30, dateReception: recu, historique: [cloture("h", "Validation du dossier", 12, recu)] }),
        // clos à J+45 sur un délai de 30 : dépassé
        d({ analyste: "a", statut: "valide", delaiReglementaire: 30, dateReception: recu, historique: [cloture("h", "Validation du dossier", 45, recu)] }),
      ],
      "T",
      AUJ,
    );
    expect(r.parAnalyste[0].tauxDansLesDelais).toBe(50);
  });

  it("exclut de la moyenne un dossier clos sans date de clôture retrouvée (import), sans planter", () => {
    const r = construireRapport([d({ analyste: "a", statut: "valide", historique: [] })], "T", AUJ);
    expect(r.parAnalyste[0].traites).toBe(1);
    expect(r.parAnalyste[0].delaiTraitementMoyen).toBeNull();
    expect(r.parAnalyste[0].tauxDansLesDelais).toBeNull();
  });
});

describe("construireRapport — périmètre", () => {
  it("reprend le périmètre annoncé, pour que l'export dise ce qu'il montre", () => {
    const r = construireRapport([d()], "Transfert de fonds, Emprunt extérieur", AUJ);
    expect(r.perimetre).toBe("Transfert de fonds, Emprunt extérieur");
  });

  it("se cale sur la date fournie, jamais sur une valeur figée", () => {
    const dossier = d({ dateReception: "2026-08-01" });
    expect(construireRapport([dossier], "T", "2026-08-11").delaiMin).toBe(20);
    expect(construireRapport([dossier], "T", "2026-08-21").delaiMin).toBe(10);
  });
});

describe("statuts", () => {
  it("classe les quatre statuts", () => {
    const statuts: Statut[] = ["en_instruction", "en_attente_pieces", "valide", "rejete"];
    const r = construireRapport(statuts.map((s) => d({ statut: s })), "T", toISODate(new Date()));
    expect(r.parStatut.every((l) => l.nombre === 1)).toBe(true);
  });
});
