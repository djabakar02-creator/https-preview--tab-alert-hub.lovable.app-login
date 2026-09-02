/**
 * Service Ora : détient la clé du fournisseur d'intelligence artificielle et
 * relaie les questions du registre. Le navigateur n'a jamais la clé.
 *
 * Sans dépendance : `node server/index.mjs`.
 * Également importé par l'application de bureau (desktop/main.mjs), qui appelle
 * `creerServeur()` avec sa propre configuration.
 *
 * Variables d'environnement
 *   ORA_FOURNISSEUR  gemini (défaut) | openai        famille d'API
 *   ORA_API_KEY      clé du fournisseur              (ou GEMINI_API_KEY)
 *   ORA_MODELE       nom du modèle
 *   ORA_BASE_URL     racine de l'API, pour un fournisseur compatible OpenAI
 *   ORA_RACINE       dossier des fichiers servis     (défaut ./dist)
 *   PORT             port d'écoute                   (défaut 8787)
 *   ORA_ORIGINE      origine autorisée en cross-origin
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SYSTEM_ORA } from "../shared/ora-persona.mjs";
import { construireRequete, ErreurRequete, lireReponse, messageErreur, validerCorps } from "./ora.mjs";

const DELAI_MS = 30_000;
const FENETRE_MS = 60_000;
const MAX_PAR_FENETRE = 20;
const TAILLE_MAX = 256 * 1024;

export function confDepuisEnvironnement(env = process.env) {
  return {
    fournisseur: env.ORA_FOURNISSEUR || "gemini",
    cle: env.ORA_API_KEY || env.GEMINI_API_KEY || "",
    modele: env.ORA_MODELE || "gemini-flash-latest",
    base: env.ORA_BASE_URL || "",
    port: Number(env.PORT) || 8787,
    origine: env.ORA_ORIGINE || "",
    racine: env.ORA_RACINE || resolve(process.cwd(), "dist"),
  };
}

/* -------------------------------------------------------------- */
/* Utilitaires                                                      */
/* -------------------------------------------------------------- */

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

function lireCorps(req) {
  return new Promise((ok, ko) => {
    let taille = 0;
    const morceaux = [];
    req.on("data", (c) => {
      taille += c.length;
      if (taille > TAILLE_MAX) {
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

/* -------------------------------------------------------------- */
/* Fabrique                                                         */
/* -------------------------------------------------------------- */

/**
 * Construit le serveur sans l'écouter. `conf` complète les variables
 * d'environnement, ce qui permet à l'application de bureau de fixer son propre
 * port et son propre dossier de fichiers.
 */
export function creerServeur(conf = {}) {
  const CONF = { ...confDepuisEnvironnement(), ...conf };
  const RACINE = resolve(CONF.racine);
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

  function repondre(res, statut, donnees, entetes = {}) {
    res.writeHead(statut, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(CONF.origine ? { "Access-Control-Allow-Origin": CONF.origine, Vary: "Origin" } : {}),
      ...entetes,
    });
    res.end(JSON.stringify(donnees));
  }

  /** Sert le dossier statique, avec repli sur index.html pour les routes du client. */
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

  serveur.conf = CONF;
  return serveur;
}

/** Démarre le service et rend le port réellement obtenu (0 = port libre). */
export function demarrer(conf = {}) {
  const serveur = creerServeur(conf);
  return new Promise((ok) => {
    serveur.listen(serveur.conf.port, "127.0.0.1", () => ok({ serveur, port: serveur.address().port }));
  });
}

/* Exécution directe : node server/index.mjs */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { serveur, port } = await demarrer();
  const c = serveur.conf;
  const etat = c.cle ? `${c.fournisseur} · ${c.modele}` : "AUCUNE CLÉ — Ora répondra en analyse locale";
  console.log(`[ora] écoute sur http://localhost:${port} · ${etat}`);
}
