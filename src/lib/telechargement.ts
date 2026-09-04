type SaveFn = (r: { filename: string; data: string | Blob }) => Promise<{ status: string }>;

export type CanalTelechargement = "capacite" | "lien" | "refus" | "format_indisponible";

/**
 * Remet un fichier à l'utilisateur, texte ou binaire.
 *
 * Sur une page publiée en aperçu Claude, un lien `download` est inerte : le
 * téléchargement doit passer par la capacité `downloads`, qui n'admet qu'une
 * liste fermée d'extensions (le classeur XLSX n'en fait pas partie). Dans ce
 * cas précis, tenter quand même le lien ne servirait à rien : on le signale
 * plutôt clairement à l'appelant. Hors de cet aperçu, `window.claude` est
 * absent et le lien blob classique fait l'affaire.
 */
export async function telechargerFichier(
  nom: string,
  donnees: string | Blob,
  type = "text/csv;charset=utf-8",
): Promise<CanalTelechargement> {
  const blob = typeof donnees === "string" ? new Blob([donnees], { type }) : donnees;

  const use = typeof window !== "undefined" ? window.claude?.use : undefined;
  if (use) {
    try {
      const dl = (await use("downloads")) as { save?: SaveFn } | null;
      if (dl?.save) {
        await dl.save({ filename: nom, data: blob });
        return "capacite";
      }
      /* Capacité déclarée mais non chargée : dans cet environnement, le lien
         direct est inerte (voir plus haut) — inutile de le tenter. */
      return "format_indisponible";
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "declined") return "refus";
      if (code === "rejected_extension" || code === "extension_not_enabled") return "format_indisponible";
      return "format_indisponible";
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "lien";
}
