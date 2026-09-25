import { afterEach, describe, expect, it, vi } from "vitest";
import { telechargerFichier } from "./telechargement";

/**
 * `telechargerFichier` lit `window.claude.use` : on simule ici les deux
 * environnements où elle tourne — l'aperçu Claude (capacité `downloads`) et
 * un navigateur ordinaire (aucune capacité, lien blob classique).
 */
function apercuClaude(save: (r: { filename: string; data: unknown }) => Promise<{ status: string }>) {
  vi.stubGlobal("window", { claude: { use: async () => ({ save }) } });
}

function navigateurOrdinaire() {
  const liens: { href: string; download: string; clicked: boolean }[] = [];
  const a = { href: "", download: "", rel: "", click: function () {}, remove: () => {} };
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", {
    createElement: () => {
      const el = { ...a };
      el.click = () => liens.push({ href: el.href, download: el.download, clicked: true });
      return el;
    },
    body: { appendChild: () => {}, },
  });
  vi.stubGlobal("URL", { createObjectURL: () => "blob:test", revokeObjectURL: () => {} });
  return liens;
}

afterEach(() => vi.unstubAllGlobals());

describe("telechargerFichier", () => {
  it("passe par la capacité downloads quand elle réussit", async () => {
    const save = vi.fn(async () => ({ status: "saved" }));
    apercuClaude(save);
    const canal = await telechargerFichier("registre.csv", "a;b\n1;2");
    expect(canal).toBe("capacite");
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ filename: "registre.csv" }));
  });

  it("signale un refus explicite de l'utilisateur", async () => {
    apercuClaude(async () => {
      throw Object.assign(new Error("declined"), { code: "declined" });
    });
    expect(await telechargerFichier("registre.csv", "a")).toBe("refus");
  });

  it("signale un format indisponible plutôt que de tenter un lien inerte (extension refusée)", async () => {
    apercuClaude(async () => {
      throw Object.assign(new Error("rejected"), { code: "rejected_extension" });
    });
    expect(await telechargerFichier("registre.xlsx", "x")).toBe("format_indisponible");
  });

  it("signale un format indisponible si l'extension est désactivée côté plateforme", async () => {
    apercuClaude(async () => {
      throw Object.assign(new Error("off"), { code: "extension_not_enabled" });
    });
    expect(await telechargerFichier("registre.xlsx", "x")).toBe("format_indisponible");
  });

  it("retombe sur un lien blob hors de l'aperçu Claude", async () => {
    const liens = navigateurOrdinaire();
    const canal = await telechargerFichier("registre.csv", "a;b");
    expect(canal).toBe("lien");
    expect(liens).toHaveLength(1);
    expect(liens[0].download).toBe("registre.csv");
  });
});
