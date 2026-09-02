import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { creerRegistre } from "./registre.mjs";
import { annuaireDemonstration, authentifier, cookieSession, lireCookie, signerSession, verifierSession } from "./comptes.mjs";

const U = {
  admin: { username: "admin", role: "admin" },
  hier: { username: "hierarchie", role: "hierarchie" },
  ana: { username: "analyste", role: "analyste" },
  autre: { username: "analyste2", role: "analyste" },
  lect: { username: "lecture", role: "lecture" },
};

let dossier;
let reg;

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), "reg-"));
  reg = creerRegistre(join(dossier, "registre.json"));
});
afterEach(() => rmSync(dossier, { recursive: true, force: true }));

const sien = () => reg.lister().find((d) => d.analyste === "analyste" && d.statut === "en_instruction");
const autrui = () => reg.lister().find((d) => d.analyste === "hierarchie");

describe("registre partagé", () => {
  it("démarre sur les données initiales et les persiste", () => {
    expect(reg.lister().length).toBeGreaterThan(0);
    const relu = JSON.parse(readFileSync(join(dossier, "registre.json"), "utf8"));
    expect(relu.length).toBe(reg.lister().length);
  });

  it("un second registre relit le fichier au lieu de le réinitialiser", () => {
    const d = sien();
    reg.enregistrer(U.ana, { ...d, demandeur: "Nom corrigé" });
    const autre = creerRegistre(join(dossier, "registre.json"));
    expect(autre.lister().find((x) => x.id === d.id).demandeur).toBe("Nom corrigé");
  });

  it("refuse d'écraser un fichier illisible", () => {
    writeFileSync(join(dossier, "registre.json"), "{ ceci n'est pas du JSON");
    expect(() => creerRegistre(join(dossier, "registre.json")).lister()).toThrow(/illisible/);
  });
});

describe("permissions vérifiées à l'écriture", () => {
  it("un analyste modifie son dossier", () => {
    const d = sien();
    const r = reg.enregistrer(U.ana, { ...d, observations: "Relancé." });
    expect(r.observations).toBe("Relancé.");
    expect(r.version).toBe(d.version + 1);
  });

  it("un analyste ne modifie ni ne supprime le dossier d'un autre", () => {
    const d = autrui();
    expect(() => reg.enregistrer(U.ana, { ...d, observations: "intrusion" })).toThrow(/autre analyste/);
    expect(() => reg.supprimer(U.ana, d.id)).toThrow(/autre analyste/);
  });

  it("un analyste ne peut pas valider un dossier, même le sien", () => {
    const d = sien();
    expect(() => reg.enregistrer(U.ana, { ...d, statut: "valide" })).toThrow(/hiérarchie/);
  });

  it("la hiérarchie valide mais ne modifie pas le fond", () => {
    const d = autrui();
    expect(reg.enregistrer(U.hier, { ...d, statut: "valide" }).statut).toBe("valide");
    const e = sien();
    expect(() => reg.enregistrer(U.hier, { ...e, demandeur: "Autre nom" })).toThrow(/autre analyste/);
  });

  it("la hiérarchie réattribue un dossier", () => {
    const d = autrui();
    expect(reg.enregistrer(U.hier, { ...d, analyste: "analyste" }).analyste).toBe("analyste");
  });

  it("le profil lecture ne peut rien écrire", () => {
    const d = sien();
    expect(() => reg.enregistrer(U.lect, { ...d, observations: "x" })).toThrow();
    expect(() => reg.supprimer(U.lect, d.id)).toThrow();
    expect(() => reg.remplacer(U.lect, [])).toThrow(/administrateur/);
  });

  it("un analyste ne crée pas un dossier au nom d'un autre", () => {
    const neuf = { ...sien(), id: "neuf", version: undefined, analyste: "analyste2" };
    expect(() => reg.enregistrer(U.ana, neuf)).toThrow(/que pour lui-même/);
  });

  it("seul l'administrateur remplace ou réinitialise le registre", () => {
    expect(() => reg.remplacer(U.hier, [])).toThrow(/administrateur/);
    expect(reg.remplacer(U.admin, [sien()]).length).toBe(1);
    expect(reg.reinitialiser(U.admin).length).toBeGreaterThan(1);
  });
});

describe("concurrence", () => {
  it("refuse une écriture fondée sur une version périmée", () => {
    const d = sien();
    reg.enregistrer(U.ana, { ...d, observations: "premier" });
    expect(() => reg.enregistrer(U.ana, { ...d, observations: "second" })).toThrow(/modifié par un autre agent/);
  });

  it("accepte l'écriture suivante une fois le dossier rechargé", () => {
    const d = sien();
    reg.enregistrer(U.ana, { ...d, observations: "premier" });
    const frais = reg.lister().find((x) => x.id === d.id);
    expect(reg.enregistrer(U.ana, { ...frais, observations: "second" }).observations).toBe("second");
  });
});

describe("validation des entrées", () => {
  it("rejette un dossier incomplet ou mal daté", () => {
    const d = sien();
    expect(() => reg.enregistrer(U.ana, { ...d, demandeur: "  " })).toThrow(/demandeur/);
    expect(() => reg.enregistrer(U.ana, { ...d, dateReception: "01/02/2026" })).toThrow(/Date de réception/);
    expect(() => reg.enregistrer(U.ana, { ...d, delaiReglementaire: 0 })).toThrow(/Délai/);
  });

  it("ignore les champs que le client inventerait", () => {
    const d = sien();
    const r = reg.enregistrer(U.ana, { ...d, role: "admin", motDePasse: "x" });
    expect(r.role).toBeUndefined();
    expect(r.motDePasse).toBeUndefined();
  });
});

describe("comptes et sessions", () => {
  const annuaire = annuaireDemonstration();
  const SECRET = "secret-de-test";

  it("authentifie sur le bon mot de passe seulement", () => {
    expect(authentifier(annuaire, "admin", "admin123")?.role).toBe("admin");
    expect(authentifier(annuaire, "admin", "mauvais")).toBeNull();
    expect(authentifier(annuaire, "inconnu", "admin123")).toBeNull();
  });

  it("ne conserve aucun mot de passe en clair", () => {
    const brut = JSON.stringify([...annuaire.values()]);
    for (const mdp of ["admin123", "analyste123", "hier123", "lecture123"]) expect(brut).not.toContain(mdp);
  });

  it("signe et relit une session", () => {
    const u = { username: "analyste", displayName: "Agent traitant", role: "analyste" };
    expect(verifierSession(SECRET, signerSession(SECRET, u))).toMatchObject(u);
  });

  it("rejette une session forgée, altérée ou expirée", () => {
    const u = { username: "analyste", role: "analyste" };
    const jeton = signerSession(SECRET, u);
    expect(verifierSession("autre-secret", jeton)).toBeNull();
    expect(verifierSession(SECRET, jeton.replace(/.$/, "0"))).toBeNull();
    expect(verifierSession(SECRET, signerSession(SECRET, u, Date.now() - 48 * 3600_000))).toBeNull();
    for (const n of ["", "abc", "a.b"]) expect(verifierSession(SECRET, n)).toBeNull();
  });

  it("pose un cookie inaccessible au JavaScript de la page", () => {
    const c = cookieSession("jeton", true);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Strict");
    expect(c).toContain("Secure");
    expect(lireCookie("a=1; ora_session=jeton; b=2", "ora_session")).toBe("jeton");
  });
});
