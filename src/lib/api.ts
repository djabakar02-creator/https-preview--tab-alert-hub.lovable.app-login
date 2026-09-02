import type { User } from "./auth";
import type { Dossier } from "./dossiers";

/**
 * Accès au service. L'application fonctionne dans deux modes :
 *
 * - `serveur` : un service répond sur /api. Le registre est partagé entre tous
 *   les agents, et les permissions sont vérifiées côté serveur.
 * - `local` : aucun service (page statique, démonstration). Le registre vit
 *   dans le navigateur, et les permissions ne sont qu'un confort d'interface.
 */
export type Mode = "serveur" | "local";

export class ErreurApi extends Error {
  constructor(
    message: string,
    readonly statut: number,
  ) {
    super(message);
  }
}

async function json<T>(chemin: string, init?: RequestInit): Promise<T> {
  const res = await fetch(chemin, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "same-origin",
  });
  const corps = (await res.json().catch(() => null)) as (T & { erreur?: string }) | null;
  if (!res.ok) throw new ErreurApi(corps?.erreur ?? "Le service a renvoyé une erreur.", res.status);
  return corps as T;
}

let modePromis: Promise<Mode> | null = null;

/**
 * Détecte une seule fois si un service est présent. On interroge un point
 * d'entrée public : sonder la session ferait apparaître un 401 dans la console
 * du navigateur à chaque ouverture, avant même toute connexion.
 */
export function detecterMode(): Promise<Mode> {
  if (!modePromis) {
    modePromis = fetch("/api/ora/etat", { credentials: "same-origin" })
      .then((r) => (r.ok ? ("serveur" as Mode) : ("local" as Mode)))
      .catch(() => "local" as Mode);
  }
  return modePromis;
}

export const api = {
  seConnecter: (username: string, motDePasse: string) =>
    json<User>("/api/session", { method: "POST", body: JSON.stringify({ username, motDePasse }) }),
  seDeconnecter: () => json<{ fin: boolean }>("/api/session", { method: "DELETE" }),
  session: () =>
    json<User & { connecte: boolean }>("/api/session").then((r) => (r.connecte ? (r as User) : null)),

  lister: () => json<{ dossiers: Dossier[] }>("/api/dossiers").then((r) => r.dossiers),
  enregistrer: (d: Dossier) =>
    json<Dossier>(`/api/dossiers/${encodeURIComponent(d.id)}`, { method: "PUT", body: JSON.stringify(d) }),
  supprimer: (id: string) => json<{ supprime: string }>(`/api/dossiers/${encodeURIComponent(id)}`, { method: "DELETE" }),
  importer: (dossiers: Dossier[]) =>
    json<{ dossiers: Dossier[] }>("/api/dossiers/import", { method: "POST", body: JSON.stringify({ dossiers }) }).then(
      (r) => r.dossiers,
    ),
  reinitialiser: () =>
    json<{ dossiers: Dossier[] }>("/api/dossiers/reinitialiser", { method: "POST" }).then((r) => r.dossiers),
};
