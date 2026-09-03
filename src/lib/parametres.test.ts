import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** localStorage minimal, en mémoire : suffisant pour le module testé. */
function stockageMemoire() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

let creerCompte: typeof import("./parametres").creerCompte;
let modifierCompte: typeof import("./parametres").modifierCompte;
let supprimerCompte: typeof import("./parametres").supprimerCompte;
let definirDelai: typeof import("./parametres").definirDelai;
let comptesLocaux: typeof import("./parametres").comptesLocaux;

/* Le module tient son état (comptes, délais) dans des variables de module, à
   l'image du registre : chaque test repart d'une instance fraîche, sans quoi
   les comptes créés par un test fuiraient dans le suivant. */
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("localStorage", stockageMemoire());
  ({ creerCompte, modifierCompte, supprimerCompte, definirDelai, comptesLocaux } = await import("./parametres"));
});
afterEach(() => vi.unstubAllGlobals());

describe("comptesLocaux — amorçage", () => {
  it("amorce les quatre comptes de démonstration au premier accès", () => {
    const comptes = comptesLocaux();
    expect(comptes.map((c) => c.username).sort()).toEqual(["admin", "analyste", "hierarchie", "lecture"]);
  });
});

describe("creerCompte (mode local)", () => {
  it("refuse un identifiant déjà attribué, un nom vide, ou un mot de passe trop court", async () => {
    await expect(
      creerCompte("admin", { username: "admin", displayName: "X", role: "analyste", motDePasse: "motdepasse1" }),
    ).rejects.toThrow(/déjà attribué/);
    await expect(creerCompte("admin", { username: "usr", displayName: "  ", role: "analyste", motDePasse: "motdepasse1" })).rejects.toThrow(
      /nom affiché/,
    );
    await expect(creerCompte("admin", { username: "usr", displayName: "X", role: "analyste", motDePasse: "court" })).rejects.toThrow(
      /8 caractères/,
    );
  });

  it("crée un compte et lui permet de s'authentifier", async () => {
    await creerCompte("admin", { username: "Dupont", displayName: "Dupont", role: "analyste", motDePasse: "motdepasse1" });
    const comptes = comptesLocaux();
    expect(comptes.some((c) => c.username === "dupont" && c.password === "motdepasse1")).toBe(true);
  });
});

describe("modifierCompte (mode local)", () => {
  it("refuse de rétrograder le dernier administrateur", async () => {
    await expect(modifierCompte("admin", "admin", { role: "analyste" })).rejects.toThrow(/dernier administrateur/);
  });

  it("autorise la rétrogradation s'il reste un autre administrateur", async () => {
    await creerCompte("admin", { username: "admin2", displayName: "Second admin", role: "admin", motDePasse: "motdepasse1" });
    await expect(modifierCompte("admin", "admin", { role: "analyste" })).resolves.toBeUndefined();
  });

  it("change le mot de passe sans toucher au reste", async () => {
    await modifierCompte("admin", "analyste", { motDePasse: "nouveaumotdepasse" });
    const c = comptesLocaux().find((x) => x.username === "analyste")!;
    expect(c.password).toBe("nouveaumotdepasse");
    expect(c.role).toBe("analyste");
  });
});

describe("supprimerCompte (mode local)", () => {
  it("refuse qu'un administrateur supprime son propre compte", async () => {
    await expect(supprimerCompte("admin", "admin")).rejects.toThrow(/propre compte/);
  });

  it("refuse de supprimer le dernier administrateur", async () => {
    await creerCompte("admin", { username: "acteur", displayName: "Acteur", role: "analyste", motDePasse: "motdepasse1" });
    await expect(supprimerCompte("acteur", "admin")).rejects.toThrow(/dernier administrateur/);
  });

  it("supprime un compte ordinaire", async () => {
    await supprimerCompte("admin", "analyste");
    expect(comptesLocaux().some((c) => c.username === "analyste")).toBe(false);
  });
});

describe("definirDelai (mode local)", () => {
  it("refuse un délai non entier, nul ou négatif", async () => {
    await expect(definirDelai("admin", "immobilier_hors_cemac", { jours: 0, ouvres: false })).rejects.toThrow();
    await expect(definirDelai("admin", "immobilier_hors_cemac", { jours: -1, ouvres: false })).rejects.toThrow();
    await expect(definirDelai("admin", "immobilier_hors_cemac", { jours: 12.5, ouvres: false })).rejects.toThrow();
  });

  it("fixe le délai avec la source « parametre », et le fait survivre à un rechargement", async () => {
    await definirDelai("admin", "immobilier_hors_cemac", { jours: 45, ouvres: false });
    // Un second import relit le stockage local (même instance stubbée), comme le ferait un rechargement de page.
    vi.resetModules();
    const frais = await import("./parametres");
    await frais.initialiserParametres(false);
    const brut = JSON.parse(localStorage.getItem("beac-drc:delais:v1")!);
    expect(brut.immobilier_hors_cemac).toEqual({ jours: 45, ouvres: false, source: "parametre" });
  });
});
