type SaveFn = (r: { filename: string; data: string | Blob }) => Promise<{ status: string }>;

/**
 * Remet un fichier à l'utilisateur, texte ou binaire.
 *
 * Sur une page publiée en bac à sable, un lien `download` est inerte : le
 * téléchargement doit passer par la capacité `downloads`. Ailleurs, le lien
 * blob classique fait l'affaire. On essaie donc la capacité d'abord.
 *
 * Renvoie le canal utilisé, ou `refus` si l'utilisateur a décliné.
 */
export async function telechargerFichier(
  nom: string,
  donnees: string | Blob,
  type = "text/csv;charset=utf-8",
): Promise<"capacite" | "lien" | "refus"> {
  const blob = typeof donnees === "string" ? new Blob([donnees], { type }) : donnees;

  const use = typeof window !== "undefined" ? window.claude?.use : undefined;
  if (use) {
    try {
      const dl = (await use("downloads")) as { save?: SaveFn } | null;
      if (dl?.save) {
        await dl.save({ filename: nom, data: blob });
        return "capacite";
      }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "declined") return "refus";
      /* Capacité absente ou en échec : on retombe sur le lien. */
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
