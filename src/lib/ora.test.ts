import { describe, expect, it } from "vitest";
import { analyseLocale, contexteDossier, demanderOra, reponseLocale } from "./ora";
import { piecesRequises, type Dossier } from "./dossiers";
import { addDays, formatDateFR, toISODate } from "./dates";

const today = toISODate(new Date());

function dossier(over: Partial<Dossier> = {}): Dossier {
  return {
    id: "d1",
    reference: "DRC/SA/2026/0044",
    demandeur: "Nguema Ondo Pascal",
    type: "compte_devises",
    montant: 0,
    devise: "XAF",
    dateReception: addDays(today, -14),
    delaiReglementaire: 30,
    analyste: "analyste",
    statut: "en_attente_pieces",
    pieces: piecesRequises("compte_devises").map((p, i) => ({ ...p, fourni: i < 2 })),
    observations: "",
    historique: [],
    ...over,
  };
}

describe("contexteDossier", () => {
  it("transmet le délai calculé par le registre, pas une valeur stockée", () => {
    const ctx = contexteDossier(dossier());
    expect(ctx).toContain("Jours écoulés : J+14");
    expect(ctx).toContain("Délai restant : 16 jour(s)");
    expect(ctx).toContain(`Échéance : ${formatDateFR(addDays(today, 16))}`);
  });

  it("neutralise le décompte sur un dossier clos", () => {
    expect(contexteDossier(dossier({ statut: "valide" }))).toContain("Délai restant : sans objet, dossier clos");
  });

  it("marque les pièces manquantes en clair", () => {
    const ctx = contexteDossier(dossier());
    expect(ctx).toContain("Justificatif d'activité : MANQUANTE");
    expect(ctx).toContain("Registre de commerce : fournie");
  });
});

describe("analyseLocale", () => {
  it("couvre les quatre points d'instruction", () => {
    const a = analyseLocale(dossier());
    for (const t of ["1. Qualification", "2. Pièces", "3. Conformité des délais", "4. Décision proposée"]) {
      expect(a).toContain(t);
    }
  });

  it("signale le dépassement de délai et le chiffre", () => {
    const a = analyseLocale(dossier({ dateReception: addDays(today, -40) }));
    expect(a).toContain("délai réglementaire dépassé de 10 jour(s)");
  });

  it("alerte sur un dossier non attribué", () => {
    expect(analyseLocale(dossier({ analyste: null }))).toContain("Aucun analyste traitant n'est attribué");
  });
});

describe("reponseLocale", () => {
  it("liste les pièces à réclamer quand la question porte sur les pièces", () => {
    const r = reponseLocale("Que faut-il réclamer au demandeur ?", dossier());
    expect(r).toContain("Justificatif d'activité");
    expect(r).toContain("Attestation bancaire");
    expect(r).not.toContain("1. Qualification");
  });

  it("répond sur les délais quand la question porte sur l'échéance", () => {
    const r = reponseLocale("Y a-t-il un risque de dépassement de délai ?", dossier());
    expect(r).toContain("J+14");
    expect(r).toContain("16 jour(s)");
    expect(r).not.toContain("2. Pièces");
  });

  it("isole la décision proposée", () => {
    const r = reponseLocale("Rédige une proposition de décision motivée.", dossier());
    expect(r).toContain("4. Décision proposée");
    expect(r).not.toContain("1. Qualification");
  });

  it("rend l'analyse complète sur une demande de vérification", () => {
    expect(reponseLocale("Vérifie ce dossier complet.", dossier())).toContain("1. Qualification");
  });

  it("dit franchement ce qu'il ne peut pas traiter hors ligne", () => {
    const r = reponseLocale("Que penses-tu de la conjoncture au Gabon ?", dossier());
    expect(r).toContain("Je ne peux pas traiter une question libre");
  });

  it("ne réclame rien sur un dossier complet", () => {
    const complet = dossier({ pieces: piecesRequises("compte_devises").map((p) => ({ ...p, fourni: true })) });
    expect(reponseLocale("Quelles pièces manquent ?", complet)).toContain("est complet");
  });
});

describe("demanderOra", () => {
  it("bascule sur l'analyse locale quand aucun moteur distant ne répond", async () => {
    const rep = await demanderOra("Vérifie ce dossier.", dossier(), [], { timeoutMs: 300 });
    expect(rep.moteur).toBe("local");
    expect(rep.content).toContain("Décision proposée");
  });

  it("répond même sans dossier sélectionné", async () => {
    const rep = await demanderOra("Bonjour", null, [], { timeoutMs: 300 });
    expect(rep.role).toBe("ora");
    expect(rep.content.length).toBeGreaterThan(0);
  });
});
