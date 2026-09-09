/**
 * Comptes et sessions, côté service.
 *
 * Les mots de passe ne sont jamais stockés en clair : seul un condensat scrypt
 * est conservé. La session tient dans un cookie signé, sans état côté serveur.
 *
 * Comptes de démonstration : à remplacer par l'annuaire de la Banque
 * (LDAP, Active Directory) avant tout usage réel. Le reste du service n'en
 * dépend pas : il lui suffit d'un objet { username, role }.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const ROLES = ["admin", "hierarchie", "analyste", "lecture"];
const DUREE_SESSION_MS = 12 * 60 * 60 * 1000;

function hacher(motDePasse, sel) {
  return scryptSync(motDePasse, sel, 32).toString("hex");
}

function compte(username, motDePasse, displayName, role) {
  const sel = randomBytes(16).toString("hex");
  return { username, displayName, role, sel, condensat: hacher(motDePasse, sel) };
}

/** Annuaire de démonstration, construit au démarrage. */
export function annuaireDemonstration() {
  return new Map(
    [
      compte("admin", "admin123", "Administrateur", "admin"),
      compte("analyste", "analyste123", "Agent traitant", "analyste"),
      compte("hierarchie", "hier123", "Chef de service", "hierarchie"),
      compte("lecture", "lecture123", "Consultation", "lecture"),
    ].map((c) => [c.username, c]),
  );
}

/** Rend l'utilisateur si les identifiants concordent, sinon null. */
export function authentifier(annuaire, username, motDePasse) {
  const c = annuaire.get(String(username ?? "").trim().toLowerCase());
  /* Condensat factice quand le compte n'existe pas : le temps de réponse ne
     doit pas révéler quels identifiants existent. */
  const sel = c?.sel ?? "00000000000000000000000000000000";
  const attendu = Buffer.from(c?.condensat ?? hacher("", sel), "hex");
  const fourni = Buffer.from(hacher(String(motDePasse ?? ""), sel), "hex");
  const concorde = attendu.length === fourni.length && timingSafeEqual(attendu, fourni);
  return c && concorde ? { username: c.username, displayName: c.displayName, role: c.role } : null;
}

/* ------------------------------------------------------------------ */
/* Cookie de session signé                                              */
/* ------------------------------------------------------------------ */

const b64 = (s) => Buffer.from(s, "utf8").toString("base64url");
const deb64 = (s) => Buffer.from(s, "base64url").toString("utf8");

export function signerSession(secret, utilisateur, maintenant = Date.now()) {
  const charge = b64(JSON.stringify({ ...utilisateur, exp: maintenant + DUREE_SESSION_MS }));
  const signature = createHmac("sha256", secret).update(charge).digest("base64url");
  return `${charge}.${signature}`;
}

/** Rend l'utilisateur porté par le jeton, ou null s'il est invalide ou expiré. */
export function verifierSession(secret, jeton, maintenant = Date.now()) {
  if (typeof jeton !== "string" || !jeton.includes(".")) return null;
  const [charge, signature] = jeton.split(".");
  if (!charge || !signature) return null;
  const attendue = createHmac("sha256", secret).update(charge).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(attendue);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { exp, ...utilisateur } = JSON.parse(deb64(charge));
    if (typeof exp !== "number" || exp < maintenant) return null;
    if (!utilisateur.username || !ROLES.includes(utilisateur.role)) return null;
    return utilisateur;
  } catch {
    return null;
  }
}

export function lireCookie(entete, nom) {
  for (const part of String(entete ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === nom) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function cookieSession(jeton, securise) {
  const base = `ora_session=${encodeURIComponent(jeton)}; Path=/; HttpOnly; SameSite=Strict`;
  return jeton ? `${base}; Max-Age=${DUREE_SESSION_MS / 1000}${securise ? "; Secure" : ""}` : `${base}; Max-Age=0`;
}
