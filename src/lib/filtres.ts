import type { CalculDelai } from "./delais";
import { TYPE_LABELS, type Dossier } from "./dossiers";

export interface FiltreRegistre {
  /** Recherche libre sur la référence, le demandeur et le type. */
  q: string;
  /** Statut exact, `en_cours` pour instruction + attente, ou vide pour tous. */
  statut: string;
  /** Niveau de délai exact, ou vide pour tous. */
  niveau: string;
  /** `__tous`, `__mine`, `__none`, ou un nom d'utilisateur. */
  analyste: string;
}

export const FILTRE_VIDE: FiltreRegistre = { q: "", statut: "", niveau: "", analyste: "__tous" };

/** Filtre par défaut à l'ouverture du registre, selon le profil. */
export function filtreInitial(role: string): FiltreRegistre {
  return { ...FILTRE_VIDE, analyste: role === "analyste" ? "__mine" : "__tous" };
}

const EN_COURS = ["en_instruction", "en_attente_pieces"];

/** Un dossier passe-t-il les filtres du registre ? */
export function correspond(d: Dossier, c: CalculDelai, f: FiltreRegistre, moi: string): boolean {
  const q = f.q.trim().toLowerCase();
  if (q && !`${d.reference} ${d.demandeur} ${TYPE_LABELS[d.type]}`.toLowerCase().includes(q)) return false;

  if (f.statut === "en_cours") {
    if (!EN_COURS.includes(d.statut)) return false;
  } else if (f.statut && d.statut !== f.statut) return false;

  if (f.niveau && c.niveau !== f.niveau) return false;

  switch (f.analyste) {
    case "":
    case "__tous":
      break;
    case "__mine":
      if (d.analyste !== moi) return false;
      break;
    case "__none":
      if (d.analyste !== null) return false;
      break;
    default:
      if (d.analyste !== f.analyste) return false;
  }
  return true;
}
