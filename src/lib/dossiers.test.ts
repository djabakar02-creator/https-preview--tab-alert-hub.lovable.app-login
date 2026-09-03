import { describe, expect, it } from "vitest";
import { fromCSV, toCSV, type Dossier } from "./dossiers";

const d: Dossier = {
  id: "x",
  reference: "DRC/SA/2026/0001",
  demandeur: 'Société "Alpha"; Beta',
  type: "immobilier_hors_cemac",
  montant: 1000,
  devise: "XAF",
  dateReception: "2026-08-01",
  delaiReglementaire: 30,
  analyste: "analyste",
  statut: "en_instruction",
  pieces: [],
  observations: "",
  historique: [],
};

describe("CSV", () => {
  it("export puis import conserve les champs", () => {
    const r = fromCSV(toCSV([d]));
    expect(r.erreurs).toEqual([]);
    expect(r.dossiers).toHaveLength(1);
    expect(r.dossiers[0].demandeur).toBe(d.demandeur);
    expect(r.dossiers[0].dateReception).toBe("2026-08-01");
    expect(r.dossiers[0].analyste).toBe("analyste");
  });

  it("l'aller-retour conserve l'état des pièces et les observations", () => {
    /* Régression : l'export omettait ces colonnes, si bien qu'un réimport
       remettait chaque dossier à « aucune pièce fournie » et effaçait les
       observations, sans le signaler. */
    const complet: Dossier = {
      ...d,
      pieces: [
        { label: "Formulaire de demande", fourni: true },
        { label: "Facture / contrat", fourni: false },
        { label: "Attestation fiscale", fourni: true },
      ],
      observations: "Relance du demandeur le 12/08 ; réponse attendue.",
    };
    const r = fromCSV(toCSV([complet]));
    expect(r.erreurs).toEqual([]);
    expect(r.dossiers[0].pieces).toEqual(complet.pieces);
    expect(r.dossiers[0].observations).toBe(complet.observations);
  });

  it("retombe sur les pièces requises du type quand la colonne est absente", () => {
    const r = fromCSV("reference;demandeur;type;dateReception\nA;B;immobilier_hors_cemac;2026-01-01");
    expect(r.dossiers[0].pieces.length).toBeGreaterThan(0);
    expect(r.dossiers[0].pieces.every((p) => !p.fourni)).toBe(true);
    expect(r.dossiers[0].observations).toBe("");
  });
  it("signale les lignes invalides sans bloquer les autres", () => {
    const r = fromCSV("reference;demandeur;type;dateReception\nA;B;immobilier_hors_cemac;2026-01-01\nC;D;inconnu;2026-01-01");
    expect(r.dossiers).toHaveLength(1);
    expect(r.erreurs).toHaveLength(1);
  });
});

describe("reprise des anciens codes d'opération", () => {
  const entete = "reference;demandeur;type;dateReception";

  it("traduit un ancien code dont l'équivalence est certaine", () => {
    const r = fromCSV(`${entete}\nA;B;investissement;2026-01-01\nC;D;emprunt;2026-01-01`);
    expect(r.erreurs).toEqual([]);
    expect(r.dossiers.map((d) => d.type)).toEqual(["investissement_direct", "pret_non_resident"]);
  });

  it("signale un ancien code sans équivalent plutôt que de le reclasser", () => {
    /* « Transfert de fonds » et « Rapatriement » ne figurent pas au catalogue :
       les ranger d'office sous une autre catégorie réglementaire serait faux. */
    const r = fromCSV(`${entete}\nA;B;transfert;2026-01-01\nC;D;rapatriement;2026-01-01`);
    expect(r.dossiers).toHaveLength(0);
    expect(r.erreurs).toHaveLength(2);
    expect(r.erreurs[0]).toContain("transfert");
  });

  it("conserve la sous-catégorie dans l'aller-retour", () => {
    const avec: Dossier = {
      ...d,
      type: "valeurs_mobilieres",
      sousType: "Pour les émissions/publicité de VM",
    };
    const r = fromCSV(toCSV([avec]));
    expect(r.dossiers[0].sousType).toBe(avec.sousType);
  });
});
