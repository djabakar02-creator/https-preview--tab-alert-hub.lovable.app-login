import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_LABELS, themeEffectif, type Theme } from "./theme";

/** Simule la préférence du poste, que le module lit via matchMedia. */
function poste(sombre: boolean) {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: sombre }) });
}

afterEach(() => vi.unstubAllGlobals());

describe("themeEffectif", () => {
  it("respecte un choix explicite, quelle que soit la préférence du poste", () => {
    poste(true);
    expect(themeEffectif("clair")).toBe("clair");
    poste(false);
    expect(themeEffectif("sombre")).toBe("sombre");
  });

  it("suit le poste en mode « système »", () => {
    poste(true);
    expect(themeEffectif("systeme")).toBe("sombre");
    poste(false);
    expect(themeEffectif("systeme")).toBe("clair");
  });

  it("retombe sur le thème clair si le poste n'exprime aucune préférence", () => {
    vi.stubGlobal("window", {});
    expect(themeEffectif("systeme")).toBe("clair");
  });

  it("nomme les trois thèmes proposés à l'agent", () => {
    const attendus: Theme[] = ["clair", "sombre", "systeme"];
    expect(Object.keys(THEME_LABELS)).toEqual(attendus);
  });
});
