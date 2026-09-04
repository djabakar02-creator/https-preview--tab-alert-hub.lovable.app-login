/**
 * Logique du service Ora, sans dépendance ni entrée/sortie : construction de la
 * requête vers le fournisseur, lecture de sa réponse, validation du corps reçu
 * du navigateur. Isolée ici pour être testable.
 */

export const SYSTEM_PATH = new URL("../src/lib/ora.ts", import.meta.url);

/** Longueurs maximales acceptées, pour ne pas relayer n'importe quoi. */
export const LIMITES = { tours: 24, caracteresParTour: 8000, caracteresTotal: 60000 };

export class ErreurRequete extends Error {
  constructor(message, statut = 400) {
    super(message);
    this.statut = statut;
  }
}

/**
 * Valide le corps envoyé par le navigateur. On n'accepte qu'une liste de tours
 * de conversation : ni consigne système, ni nom de modèle, ni paramètre de
 * génération ne viennent du client.
 */
export function validerCorps(corps) {
  if (!corps || typeof corps !== "object") throw new ErreurRequete("Corps de requête absent ou illisible.");
  const { tours } = corps;
  if (!Array.isArray(tours) || tours.length === 0) throw new ErreurRequete("Le champ « tours » doit être une liste non vide.");
  if (tours.length > LIMITES.tours) throw new ErreurRequete(`Conversation trop longue : ${LIMITES.tours} tours au maximum.`);

  let total = 0;
  const propres = tours.map((t, i) => {
    if (!t || typeof t !== "object") throw new ErreurRequete(`Tour ${i + 1} illisible.`);
    if (t.role !== "user" && t.role !== "assistant") throw new ErreurRequete(`Tour ${i + 1} : rôle « ${t.role} » non accepté.`);
    if (typeof t.content !== "string" || !t.content.trim()) throw new ErreurRequete(`Tour ${i + 1} : contenu vide.`);
    if (t.content.length > LIMITES.caracteresParTour) throw new ErreurRequete(`Tour ${i + 1} : contenu trop long.`);
    total += t.content.length;
    return { role: t.role, content: t.content };
  });
  if (total > LIMITES.caracteresTotal) throw new ErreurRequete("Conversation trop volumineuse.");
  if (propres[propres.length - 1].role !== "user") throw new ErreurRequete("Le dernier tour doit être une question.");
  return propres;
}

/* ------------------------------------------------------------------ */
/* Fournisseurs                                                         */
/* ------------------------------------------------------------------ */

/**
 * Deux familles suffisent à couvrir l'essentiel du marché :
 * - `gemini`  : Google AI Studio.
 * - `openai`  : toute API compatible OpenAI (Groq, Mistral, OpenRouter,
 *               Cerebras, Together, ou un modèle local servi par Ollama).
 */
export function construireRequete({ fournisseur, modele, base, cle, systeme, tours }) {
  if (fournisseur === "gemini") {
    return {
      url: `${base || "https://generativelanguage.googleapis.com/v1beta"}/models/${modele}:generateContent`,
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": cle },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systeme }] },
          contents: tours.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
          generationConfig: { temperature: 0.2 },
        }),
      },
    };
  }
  if (fournisseur === "openai") {
    return {
      url: `${base || "https://api.openai.com/v1"}/chat/completions`,
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
        body: JSON.stringify({
          model: modele,
          temperature: 0.2,
          messages: [{ role: "system", content: systeme }, ...tours],
        }),
      },
    };
  }
  throw new ErreurRequete(`Fournisseur inconnu : « ${fournisseur} ».`, 500);
}

/** Extrait le texte de la réponse, quel que soit le fournisseur. */
export function lireReponse(fournisseur, json) {
  const texte =
    fournisseur === "gemini"
      ? (json?.candidates?.[0]?.content?.parts ?? []).map((p) => p?.text ?? "").join("")
      : (json?.choices?.[0]?.message?.content ?? "");
  return typeof texte === "string" ? texte.trim() : "";
}

/**
 * Message d'erreur destiné au navigateur : jamais le corps brut du
 * fournisseur, qui peut contenir la clé ou des détails d'infrastructure.
 */
export function messageErreur(statut) {
  if (statut === 429) return "Le service d'intelligence artificielle est saturé. Réessayez dans un instant.";
  if (statut === 503) return "Le modèle est momentanément indisponible.";
  if (statut === 401 || statut === 403) return "La configuration du service est incorrecte : clé refusée par le fournisseur.";
  if (statut === 404) return "Le modèle configuré est introuvable chez le fournisseur.";
  return "Le service d'intelligence artificielle est injoignable.";
}
