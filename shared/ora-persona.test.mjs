import { describe, expect, it } from "vitest";
import { SYSTEM_ORA, TEXTES_REFERENCE } from "./ora-persona.mjs";

/**
 * Verrouille les faits chiffrés transmis à Ora : un futur remaniement de la
 * consigne système ne doit pas silencieusement en perdre ou en déformer un
 * seul, sans quoi Ora citerait un seuil ou un délai inexact — la faute que
 * la consigne elle-même qualifie de grave.
 */
describe("TEXTES_REFERENCE — faits chiffrés des instructions BEAC", () => {
  it("cite les cinq instructions par leur numéro et leur date", () => {
    expect(TEXTES_REFERENCE).toContain("Instruction n° 001/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 002/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 002/GR/2020 du 22 septembre 2020");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 003/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 004/GR/2019 du 10 juin 2019");
  });

  it("retient le délai et l'acceptation tacite de l'Instruction n° 001/GR/2019", () => {
    expect(TEXTES_REFERENCE).toContain("30 jours ouvrés");
    expect(TEXTES_REFERENCE).toContain("réputée acceptée par la Banque centrale");
  });

  it("retient les plafonds de commission de transfert (Instructions 002/GR/2019 et 002/GR/2020)", () => {
    expect(TEXTES_REFERENCE).toContain("1 % hors taxes");
    expect(TEXTES_REFERENCE).toContain("0,50 %");
    expect(TEXTES_REFERENCE).toContain("5 000 francs CFA");
    expect(TEXTES_REFERENCE).toContain("0,25 % hors taxes");
    expect(TEXTES_REFERENCE).toContain("0,5 % hors taxe");
    expect(TEXTES_REFERENCE).toContain("3 %");
  });

  it("retient le taux de rétrocession et son délai (Instruction n° 003/GR/2019)", () => {
    expect(TEXTES_REFERENCE).toContain("70 %");
    expect(TEXTES_REFERENCE).toContain("3 jours ouvrés");
  });

  it("retient le plafond des avoirs en devises (Instruction n° 004/GR/2019)", () => {
    expect(TEXTES_REFERENCE).toContain("5 % des dépôts à vue");
    expect(TEXTES_REFERENCE).toContain("ne constitue pas un besoin courant");
  });

  it("précise que seule l'Instruction 001 régit un type du catalogue du Service", () => {
    expect(TEXTES_REFERENCE).toContain("Seule l'Instruction n° 001/GR/2019 régit directement un type traité par le Service des Autorisations");
  });

  it("est bien intégré à la consigne système envoyée au modèle", () => {
    expect(SYSTEM_ORA).toContain(TEXTES_REFERENCE);
  });
});
