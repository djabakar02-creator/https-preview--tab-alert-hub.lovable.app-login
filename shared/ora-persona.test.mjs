import { describe, expect, it } from "vitest";
import { SYSTEM_ORA, TEXTES_REFERENCE } from "./ora-persona.mjs";

/**
 * Verrouille les faits chiffrés transmis à Ora : un futur remaniement de la
 * consigne système ne doit pas silencieusement en perdre ou en déformer un
 * seul, sans quoi Ora citerait un seuil ou un délai inexact — la faute que
 * la consigne elle-même qualifie de grave.
 */
describe("TEXTES_REFERENCE — faits chiffrés des instructions BEAC", () => {
  it("cite les quinze instructions par leur numéro et leur date", () => {
    expect(TEXTES_REFERENCE).toContain("Instruction n° 001/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 002/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 002/GR/2020 du 22 septembre 2020");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 003/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 004/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 005/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 006/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 007/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 008/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 009/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 010/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 011/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 012/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 013/GR/2019 du 10 juin 2019");
    expect(TEXTES_REFERENCE).toContain("Instruction n° 014/GR/2019 du 10 juin 2019");
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

  it("retient la durée et le préavis de renouvellement des comptes en devises (Instruction n° 005/GR/2019)", () => {
    expect(TEXTES_REFERENCE).toContain("ne peut excéder 2 ans");
    expect(TEXTES_REFERENCE).toContain("Quarante-cinq (45) jours au moins avant l'expiration");
    expect(TEXTES_REFERENCE).toContain("ne fixe toutefois aucun délai de réponse de la Banque centrale");
  });

  it("retient le seuil de domiciliation et le délai de rapatriement des exportations (Instruction n° 006/GR/2019)", () => {
    expect(TEXTES_REFERENCE).toContain("5 millions de F CFA");
    expect(TEXTES_REFERENCE).toContain("150 jours");
  });

  it("retient les délais d'apurement des importations (Instruction n° 007/GR/2019)", () => {
    expect(TEXTES_REFERENCE).toContain("trois (3) mois pour les biens importés");
    expect(TEXTES_REFERENCE).toContain("un (1) mois pour l'importation des services");
  });

  it("retient les seuils des instruments de paiement électronique (Instruction n° 008/GR/2019)", () => {
    expect(TEXTES_REFERENCE).toContain("5 millions de Francs CFA, par personne et par voyage");
    expect(TEXTES_REFERENCE).toContain("1 million de Francs CFA, par mois et par personne");
  });

  it("retient le plafond d'encaisse des sous-délégataires de change (Instruction n° 009/GR/2019)", () => {
    expect(TEXTES_REFERENCE).toContain("5 000 000 Francs CFA");
    expect(TEXTES_REFERENCE).toContain("La vente de devises à la clientèle par les sous-délégataires est prohibée");
  });

  it("récapitule la correspondance avec le catalogue, sans laisser croire à une couverture plus large", () => {
    expect(TEXTES_REFERENCE).toContain("cinq bénéficient d'un texte cité ci-dessus");
    expect(TEXTES_REFERENCE).toContain(
      "Les quatre autres types — immobilier hors CEMAC, investissement direct à l'étranger, prêt à un non-résident, investissement de portefeuille sortant — n'ont aucun texte applicable",
    );
  });

  it("retient le délai d'approvisionnement en devises de la Banque centrale (Instruction n° 010/GR/2019)", () => {
    expect(TEXTES_REFERENCE).toContain("2 jours ouvrés");
    expect(TEXTES_REFERENCE).toContain("moins de 12 mois");
  });

  it("retient l'agrément et le délai d'avis conforme du bureau de change (Instruction n° 011/GR/2019)", () => {
    expect(TEXTES_REFERENCE).toContain("cinquante millions (50 000 000) Francs CFA");
    expect(TEXTES_REFERENCE).toContain("délai de deux (2) mois");
    expect(TEXTES_REFERENCE).toContain("considéré comme délivré");
    expect(TEXTES_REFERENCE).toContain("délai maximum d'un (1) an");
  });

  it("retient les deux délais des valeurs mobilières étrangères (Instruction n° 012/GR/2019)", () => {
    expect(TEXTES_REFERENCE).toContain("50 millions de Francs CFA");
    expect(TEXTES_REFERENCE).toContain("délai de 30 jours à compter de la réception du dossier complet");
    expect(TEXTES_REFERENCE).toContain("délai de 10 jours ouvrés");
    expect(TEXTES_REFERENCE).toContain("réputée accordée");
  });

  it("retient les délais de déclaration périodique (Instruction n° 013/GR/2019)", () => {
    expect(TEXTES_REFERENCE).toContain("100 millions de Francs CFA");
    expect(TEXTES_REFERENCE).toContain("au moins 30 jours avant leur réalisation");
    expect(TEXTES_REFERENCE).toContain("30 jours après leur réalisation");
  });

  it("retient les délais et plafonds de la procédure de sanction (Instruction n° 014/GR/2019)", () => {
    expect(TEXTES_REFERENCE).toContain("délai de huit (08) jours");
    expect(TEXTES_REFERENCE).toContain("quinze (15) jours");
    expect(TEXTES_REFERENCE).toContain("pénalité de 5 % par jour de retard");
    expect(TEXTES_REFERENCE).toContain("15 % des fonds propres");
    expect(TEXTES_REFERENCE).toContain("50 % des fonds propres");
  });

  it("est bien intégré à la consigne système envoyée au modèle", () => {
    expect(SYSTEM_ORA).toContain(TEXTES_REFERENCE);
  });
});
