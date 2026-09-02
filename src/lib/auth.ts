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
 * Comptes de démonstration. En production, remplacer par une authentification
 * serveur (les mots de passe ne doivent jamais être embarqués côté client).
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

export function authenticate(username: string, password: string): User | null {
  const account = DEMO_ACCOUNTS.find(
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
