import { describe, expect, it } from "vitest";
import { calculerDelai } from "./delais";
import { piecesRequises, type Dossier, type Statut } from "./dossiers";
import { correspond, filtreInitial, FILTRE_VIDE, type FiltreRegistre } from "./filtres";
import { addDays, toISODate } from "./dates";

const today = toISODate(new Date());

function d(over: Partial<Dossier> = {}): Dossier {
  return {
    id: "x",
    reference: "DRC/SA/2026/0041",
    demandeur: "Ondimba Marie‑Claire",
    type: "transfert",
    montant: 0,
    devise: "XAF",
    dateReception: addDays(today, -5),
    delaiReglementaire: 30,
    analyste: "analyste",
    statut: "en_instruction",
    pieces: piecesRequises("transfert"),
    observations: "",
    historique: [],
    ...over,
  };
}
const ok = (dos: Dossier, f: Partial<FiltreRegistre> = {}, moi = "analyste") =>
  correspond(dos, calculerDelai(dos.dateReception, dos.delaiReglementaire), { ...FILTRE_VIDE, ...f }, moi);

describe("filtreInitial", () => {
  it("cadre l'analyste sur ses dossiers et ouvre le registre aux autres", () => {
    expect(filtreInitial("analyste").analyste).toBe("__mine");
    expect(filtreInitial("hierarchie").analyste).toBe("__tous");
    expect(filtreInitial("admin").analyste).toBe("__tous");
  });
});

describe("correspond — filtre analyste", () => {
  it("« Tous les analystes » ne retombe pas sur « Mes dossiers »", () => {
    /* Régression : la valeur « tous » doit être explicite, sans quoi un
       analyste ne pouvait plus consulter le registre entier. */
    const autrui = d({ analyste: "hierarchie" });
    expect(ok(autrui, { analyste: "__tous" })).toBe(true);
    expect(ok(autrui, { analyste: "__mine" })).toBe(false);
  });

  it("isole mes dossiers, les non attribués et un analyste nommé", () => {
    expect(ok(d({ analyste: "analyste" }), { analyste: "__mine" })).toBe(true);
    expect(ok(d({ analyste: null }), { analyste: "__none" })).toBe(true);
    expect(ok(d({ analyste: "analyste" }), { analyste: "__none" })).toBe(false);
    expect(ok(d({ analyste: "hierarchie" }), { analyste: "hierarchie" })).toBe(true);
    expect(ok(d({ analyste: "analyste" }), { analyste: "hierarchie" })).toBe(false);
  });

  it("traite la chaîne vide comme « tous », pour les liens déjà en circulation", () => {
    expect(ok(d({ analyste: "hierarchie" }), { analyste: "" })).toBe(true);
  });
});

describe("correspond — statut, niveau, recherche", () => {
  it("regroupe instruction et attente de pièces sous « en cours »", () => {
    const enCours: Statut[] = ["en_instruction", "en_attente_pieces"];
    for (const s of enCours) expect(ok(d({ statut: s }), { statut: "en_cours" })).toBe(true);
    for (const s of ["valide", "rejete"] as Statut[]) expect(ok(d({ statut: s }), { statut: "en_cours" })).toBe(false);
  });

  it("filtre sur le niveau de délai recalculé", () => {
    const urgent = d({ dateReception: addDays(today, -28) });
    expect(ok(urgent, { niveau: "urgent" })).toBe(true);
    expect(ok(urgent, { niveau: "conforme" })).toBe(false);
  });

  it("cherche dans la référence, le demandeur et le type, sans tenir compte de la casse", () => {
    expect(ok(d(), { q: "ondimba" })).toBe(true);
    expect(ok(d(), { q: "0041" })).toBe(true);
    expect(ok(d(), { q: "Transfert" })).toBe(true);
    expect(ok(d(), { q: "  " })).toBe(true);
    expect(ok(d(), { q: "emprunt" })).toBe(false);
  });

  it("combine les filtres", () => {
    const dos = d({ analyste: "analyste", statut: "en_attente_pieces" });
    expect(ok(dos, { analyste: "__mine", statut: "en_cours", q: "ondimba" })).toBe(true);
    expect(ok(dos, { analyste: "__mine", statut: "valide" })).toBe(false);
  });
});
