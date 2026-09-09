import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* Le store tient son état dans des variables de module : chaque test repart
   d'une instance fraîche, comme pour src/lib/parametres.ts. */
let mod: typeof import("./ora-conversation");

beforeEach(async () => {
  vi.resetModules();
  mod = await import("./ora-conversation");
});
afterEach(() => vi.resetModules());

describe("store de conversation — état", () => {
  it("démarre repliée, sans dossier ni message", () => {
    const e = mod.obtenirEtatOra();
    expect(e).toEqual({ dossierId: "", messages: [], partiel: "", enCours: false, ouvert: false });
  });

  it("ouvre, ferme et bascule la bulle", () => {
    mod.ouvrirOra();
    expect(mod.obtenirEtatOra().ouvert).toBe(true);
    mod.fermerOra();
    expect(mod.obtenirEtatOra().ouvert).toBe(false);
    mod.basculerOra();
    expect(mod.obtenirEtatOra().ouvert).toBe(true);
    mod.basculerOra();
    expect(mod.obtenirEtatOra().ouvert).toBe(false);
  });

  it("mémorise le dossier sélectionné", () => {
    mod.definirDossierOra("d42");
    expect(mod.obtenirEtatOra().dossierId).toBe("d42");
  });
});

describe("envoyerOra", () => {
  it("ajoute la question de l'agent immédiatement, avant même la réponse", async () => {
    const promesse = mod.envoyerOra("Bonjour", null, 300);
    expect(mod.obtenirEtatOra().enCours).toBe(true);
    expect(mod.obtenirEtatOra().messages).toEqual([{ role: "user", content: "Bonjour" }]);
    await promesse;
    expect(mod.obtenirEtatOra().enCours).toBe(false);
    expect(mod.obtenirEtatOra().messages).toHaveLength(2);
    expect(mod.obtenirEtatOra().messages[1].role).toBe("ora");
  });

  it("ignore une question vide, sans ajouter de message", async () => {
    await mod.envoyerOra("   ", null, 300);
    expect(mod.obtenirEtatOra().messages).toEqual([]);
  });

  it("ignore un envoi pendant qu'une réponse est en cours", async () => {
    const premiere = mod.envoyerOra("Première question", null, 300);
    await mod.envoyerOra("Question ignorée pendant l'attente", null, 300);
    expect(mod.obtenirEtatOra().messages).toHaveLength(1);
    await premiere;
  });

  it("nouvelleConversationOra vide les messages sans toucher au dossier choisi", async () => {
    mod.definirDossierOra("d1");
    await mod.envoyerOra("Une question", null, 300);
    mod.nouvelleConversationOra();
    expect(mod.obtenirEtatOra().messages).toEqual([]);
    expect(mod.obtenirEtatOra().dossierId).toBe("d1");
  });

  it("interrompreOra annule une réponse en cours sans laisser enCours bloqué", async () => {
    const promesse = mod.envoyerOra("Question longue", null, 20_000);
    mod.interrompreOra();
    await promesse;
    expect(mod.obtenirEtatOra().enCours).toBe(false);
  });
});
