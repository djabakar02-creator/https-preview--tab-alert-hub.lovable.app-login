import { describe, expect, it } from "vitest";
import { fromCSV, toCSV, type Dossier } from "./dossiers";

const d: Dossier = {
  id: "x",
  reference: "DRC/SA/2026/0001",
  demandeur: 'Société "Alpha"; Beta',
  type: "transfert",
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
  it("signale les lignes invalides sans bloquer les autres", () => {
    const r = fromCSV("reference;demandeur;type;dateReception\nA;B;transfert;2026-01-01\nC;D;inconnu;2026-01-01");
    expect(r.dossiers).toHaveLength(1);
    expect(r.erreurs).toHaveLength(1);
  });
});
