import type { Moteur } from "../lib/ora";

/** Origine de la réponse, affichée sous le nom d'Ora : la transparence sur le moteur fait partie du produit. */
export const MOTEUR_LABELS: Record<Moteur, string> = {
  service: "service BEAC",
  claude: "Claude",
  gemini: "Gemini",
  local: "analyse locale",
};

/** Rendu minimal des réponses d'Ora : gras, italique, listes à tirets, paragraphes. Pas de Markdown complet. */
export default function OraRendu({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text.split(/\n{2,}/).map((para, i) => {
        const italique = para.startsWith("_") && para.endsWith("_");
        const contenu = italique ? para.slice(1, -1) : para;
        return (
          <p key={i} className={italique ? "text-xs text-muted italic" : para.trimStart().startsWith("- ") ? "pl-4" : ""}>
            {contenu.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
              seg.startsWith("**") ? <strong key={j}>{seg.slice(2, -2)}</strong> : <span key={j}>{seg}</span>,
            )}
          </p>
        );
      })}
    </div>
  );
}
