import { api, detecterMode, ErreurApi } from "./api";
import { comptesLocaux } from "./parametres";

export type Role = "admin" | "hierarchie" | "analyste" | "lecture";

export interface User {
  username: string;
  displayName: string;
  role: Role;
}

interface Account extends User {
  password: string;
}

/**
 * Comptes de démonstration affichés sur l'écran de connexion, tels qu'au
 * premier lancement. L'authentification hors ligne, elle, consulte l'annuaire
 * réel (comptesLocaux(), src/lib/parametres.ts), que l'administrateur peut
 * modifier depuis l'onglet Paramètres — ce tableau ne le reflète pas après
 * modification, il documente seulement les identifiants de départ.
 */
export const DEMO_ACCOUNTS: Account[] = [
  { username: "admin", password: "admin123", displayName: "Administrateur", role: "admin" },
  { username: "analyste", password: "analyste123", displayName: "Agent traitant", role: "analyste" },
  { username: "hierarchie", password: "hier123", displayName: "Chef de service", role: "hierarchie" },
  { username: "lecture", password: "lecture123", displayName: "Consultation", role: "lecture" },
];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  hierarchie: "Hiérarchie",
  analyste: "Analyste",
  lecture: "Lecture seule",
};

const SESSION_KEY = "beac-drc:session:v1";

/**
 * Authentification. En présence d'un service, la vérification se fait côté
 * serveur et le navigateur ne reçoit qu'un cookie de session : les mots de passe
 * ci-dessus ne servent alors qu'à la démonstration hors ligne.
 */
export async function seConnecter(username: string, motDePasse: string): Promise<User | null> {
  if ((await detecterMode()) === "serveur") {
    try {
      return await api.seConnecter(username, motDePasse);
    } catch (e) {
      if (e instanceof ErreurApi && e.statut === 401) return null;
      throw e;
    }
  }
  return authenticate(username, motDePasse);
}

/** Ferme la session côté serveur le cas échéant. */
export async function seDeconnecter(): Promise<void> {
  if ((await detecterMode()) === "serveur") await api.seDeconnecter().catch(() => {});
  saveSession(null);
}

/** Session déjà ouverte : cookie du serveur, ou session locale. */
export async function sessionCourante(): Promise<User | null> {
  if ((await detecterMode()) === "serveur") {
    /* 401 attendu tant que personne n'est connecté : ce n'est pas une panne. */
    return api.session().catch(() => null);
  }
  return loadSession();
}

export function authenticate(username: string, password: string): User | null {
  const account = comptesLocaux().find(
    (a) => a.username === username.trim().toLowerCase() && a.password === password,
  );
  if (!account) return null;
  const { password: _pw, ...user } = account;
  void _pw;
  return user;
}

export function loadSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    if (!parsed?.username || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(user: User | null): void {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* stockage indisponible : session en mémoire seulement */
  }
}
