import { describe, expect, it } from "vitest";
import { calculerDelai, niveauPour } from "./delais";

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
