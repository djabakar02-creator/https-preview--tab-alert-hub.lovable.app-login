/**
 * Service Ora : détient la clé du fournisseur d'intelligence artificielle et
 * relaie les questions du registre. Le navigateur n'a jamais la clé.
 *
 * Sans dépendance : `node server/index.mjs`.
 *
 * Variables d'environnement
 *   ORA_FOURNISSEUR  gemini (défaut) | openai        famille d'API
 *   ORA_API_KEY      clé du fournisseur              (ou GEMINI_API_KEY)
 *   ORA_MODELE       nom du modèle
 *   ORA_BASE_URL     racine de l'API, pour un fournisseur compatible OpenAI
 *   PORT             port d'écoute (défaut 8787)
 *   ORA_ORIGINE      origine autorisée en cross-origin (défaut : aucune)
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { SYSTEM_ORA } from "../shared/ora-persona.mjs";
import { construireRequete, ErreurRequete, lireReponse, messageErreur, validerCorps } from "./ora.mjs";

const CONF = {
  fournisseur: process.env.ORA_FOURNISSEUR || "gemini",
  cle: process.env.ORA_API_KEY || process.env.GEMINI_API_KEY || "",
  modele: process.env.ORA_MODELE || "gemini-flash-latest",
  base: process.env.ORA_BASE_URL || "",
  port: Number(process.env.PORT) || 8787,
  origine: process.env.ORA_ORIGINE || "",
};
const RACINE = resolve(process.cwd(), "dist");
const DELAI_MS = 30_000;

/* -------------------------------------------------------------- */
/* Limitation de débit, par adresse                                 */
/* -------------------------------------------------------------- */
const FENETRE_MS = 60_000;
const MAX_PAR_FENETRE = 20;
const compteurs = new Map();

function tropDeRequetes(ip) {
  const maintenant = Date.now();
  const seuil = maintenant - FENETRE_MS;
  const recentes = (compteurs.get(ip) ?? []).filter((t) => t > seuil);
  recentes.push(maintenant);
  compteurs.set(ip, recentes);
  if (compteurs.size > 5000) for (const [k, v] of compteurs) if (!v.some((t) => t > seuil)) compteurs.delete(k);
  return recentes.length > MAX_PAR_FENETRE;
}

/* -------------------------------------------------------------- */
/* Utilitaires HTTP                                                 */
/* -------------------------------------------------------------- */
function repondre(res, statut, donnees, entetes = {}) {
  const corps = JSON.stringify(donnees);
  res.writeHead(statut, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(CONF.origine ? { "Access-Control-Allow-Origin": CONF.origine, Vary: "Origin" } : {}),
    ...entetes,
  });
  res.end(corps);
}

function lireCorps(req) {
  return new Promise((ok, ko) => {
    let taille = 0;
    const morceaux = [];
    req.on("data", (c) => {
      taille += c.length;
      if (taille > 256 * 1024) {
        ko(new ErreurRequete("Requête trop volumineuse.", 413));
        req.destroy();
        return;
      }
      morceaux.push(c);
    });
    req.on("end", () => {
      try {
        ok(JSON.parse(Buffer.concat(morceaux).toString("utf8") || "{}"));
      } catch {
        ko(new ErreurRequete("JSON illisible."));
      }
    });
    req.on("error", ko);
  });
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

/** Sert dist/ si présent, avec repli sur index.html pour les routes du client. */
function servirStatique(req, res, chemin) {
  if (!existsSync(RACINE)) return repondre(res, 404, { erreur: "Ressource introuvable." });
  const demande = normalize(decodeURIComponent(chemin)).replace(/^(\.\.[/\\])+/, "");
  let fichier = join(RACINE, demande);
  if (!fichier.startsWith(RACINE)) return repondre(res, 403, { erreur: "Accès refusé." });
  if (!existsSync(fichier) || statSync(fichier).isDirectory()) fichier = join(RACINE, "index.html");
  if (!existsSync(fichier)) return repondre(res, 404, { erreur: "Ressource introuvable." });
  res.writeHead(200, { "Content-Type": TYPES[extname(fichier)] ?? "application/octet-stream" });
  createReadStream(fichier).pipe(res);
}

/* -------------------------------------------------------------- */
/* Point d'entrée Ora                                               */
/* -------------------------------------------------------------- */
async function traiterOra(req, res) {
  if (!CONF.cle) return repondre(res, 503, { erreur: "Le service n'est pas configuré : aucune clé n'est définie côté serveur." });

  const ip = req.socket.remoteAddress ?? "inconnue";
  if (tropDeRequetes(ip)) return repondre(res, 429, { erreur: "Trop de requêtes. Patientez une minute." }, { "Retry-After": "60" });

  const tours = validerCorps(await lireCorps(req));
  const { url, options } = construireRequete({ ...CONF, systeme: SYSTEM_ORA, tours });

  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), DELAI_MS);
  let reponse;
  try {
    reponse = await fetch(url, { ...options, signal: ctrl.signal });
  } catch {
    return repondre(res, 504, { erreur: "Le service d'intelligence artificielle n'a pas répondu à temps." });
  } finally {
    clearTimeout(minuteur);
  }

  if (!reponse.ok) {
    /* Le corps du fournisseur n'est jamais relayé : il peut contenir la clé. */
    console.error(`[ora] ${CONF.fournisseur}/${CONF.modele} a répondu ${reponse.status}`);
    return repondre(res, reponse.status === 429 ? 429 : 502, { erreur: messageErreur(reponse.status) });
  }

  const texte = lireReponse(CONF.fournisseur, await reponse.json());
  if (!texte) return repondre(res, 502, { erreur: "Le modèle a renvoyé une réponse vide." });
  return repondre(res, 200, { texte, modele: CONF.modele });
}

/* -------------------------------------------------------------- */
/* Serveur                                                          */
/* -------------------------------------------------------------- */
const serveur = createServer(async (req, res) => {
  const chemin = (req.url ?? "/").split("?")[0];
  try {
    if (req.method === "OPTIONS" && CONF.origine) {
      return repondre(res, 204, {}, { "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    }
    if (chemin === "/api/ora/etat") {
      return repondre(res, 200, { configure: Boolean(CONF.cle), fournisseur: CONF.fournisseur, modele: CONF.modele });
    }
    if (chemin === "/api/ora") {
      if (req.method !== "POST") return repondre(res, 405, { erreur: "Méthode non autorisée." }, { Allow: "POST" });
      return await traiterOra(req, res);
    }
    if (req.method === "GET" || req.method === "HEAD") return servirStatique(req, res, chemin);
    return repondre(res, 404, { erreur: "Ressource introuvable." });
  } catch (e) {
    if (e instanceof ErreurRequete) return repondre(res, e.statut, { erreur: e.message });
    console.error("[ora] erreur inattendue :", e);
    return repondre(res, 500, { erreur: "Erreur interne." });
  }
});

serveur.listen(CONF.port, () => {
  const etat = CONF.cle ? `${CONF.fournisseur} · ${CONF.modele}` : "AUCUNE CLÉ — Ora répondra en analyse locale";
  console.log(`[ora] écoute sur http://localhost:${CONF.port} · ${etat}`);
});
