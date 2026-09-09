import { describe, expect, it } from "vitest";
import type { User } from "./auth";
import type { Dossier } from "./dossiers";
import { can } from "./permissions";

const base: Dossier = {
  id: "1",
  reference: "R",
  demandeur: "X",
  type: "immobilier_hors_cemac",
  montant: 0,
  devise: "XAF",
  dateReception: "2026-09-01",
  delaiReglementaire: 30,
  analyste: "analyste",
  statut: "en_instruction",
  pieces: [],
  observations: "",
  historique: [],
};
const other: Dossier = { ...base, id: "2", analyste: "autre" };

const u = (role: User["role"], username = role): User => ({ role, username, displayName: username });

describe("permissions", () => {
  it("l'analyste ne touche qu'à ses dossiers", () => {
    expect(can.edit(u("analyste"), base)).toBe(true);
    expect(can.edit(u("analyste"), other)).toBe(false);
    expect(can.delete(u("analyste"), other)).toBe(false);
    expect(can.decide(u("analyste"), base)).toBe(false);
  });
  it("la hiérarchie valide et réassigne sans éditer ni supprimer", () => {
    expect(can.decide(u("hierarchie"), other)).toBe(true);
    expect(can.reassign(u("hierarchie"), other)).toBe(true);
    expect(can.edit(u("hierarchie"), other)).toBe(false);
    expect(can.delete(u("hierarchie"), other)).toBe(false);
    expect(can.create(u("hierarchie"))).toBe(false);
  });
  it("la lecture ne peut rien modifier", () => {
    const l = u("lecture");
    expect(can.create(l)).toBe(false);
    expect(can.edit(l, base)).toBe(false);
    expect(can.decide(l, base)).toBe(false);
  });
  it("l'admin peut tout", () => {
    const a = u("admin");
    expect(can.edit(a, other) && can.delete(a, other) && can.decide(a, other) && can.import(a)).toBe(true);
  });
});
