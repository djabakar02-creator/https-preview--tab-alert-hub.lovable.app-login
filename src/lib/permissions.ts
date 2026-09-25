import type { User } from "./auth";
import type { Dossier } from "./dossiers";

export const can = {
  create: (u: User) => u.role === "admin" || u.role === "analyste",
  /** Édition des champs : admin partout, analyste sur ses propres dossiers. */
  edit: (u: User, d: Dossier) =>
    u.role === "admin" || (u.role === "analyste" && d.analyste === u.username),
  delete: (u: User, d: Dossier) =>
    u.role === "admin" || (u.role === "analyste" && d.analyste === u.username),
  /** Validation / rejet : contrôle hiérarchique et admin. */
  decide: (u: User, _d: Dossier) => u.role === "admin" || u.role === "hierarchie",
  reassign: (u: User, _d: Dossier) => u.role === "admin" || u.role === "hierarchie",
  import: (u: User) => u.role === "admin",
};
