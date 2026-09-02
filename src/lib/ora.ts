import { formatDateFR } from "./dates";
import { calculerDelai, NIVEAU_LABELS } from "./delais";
import { STATUT_LABELS, TYPE_LABELS, type Dossier } from "./dossiers";

export interface OraMessage {
  role: "user" | "ora";
  content: string;
  source?: "gemini" | "local";
}

/** Contexte structuré transmis au modèle (ou à l'analyse locale). */
export function contexteDossier(d: Dossier): string {
  const c = calculerDelai(d.dateReception, d.delaiReglementaire);
  const pieces = d.pieces.map((p) => `- ${p.label} : ${p.fourni ? "fournie" : "MANQUANTE"}`).join("\n");
  return [
    `Référence : ${d.reference}`,
    `Demandeur : ${d.demandeur}`,
    `Type : ${TYPE_LABELS[d.type]}`,
    `Montant : ${d.montant.toLocaleString("fr-FR")} ${d.devise}`,
    `Date de réception BEAC : ${formatDateFR(d.dateReception)}`,
    `Délai réglementaire : ${d.delaiReglementaire} jours`,
    `Jours écoulés : J+${c.joursEcoules}`,
    `Échéance : ${formatDateFR(c.echeance)}`,
    `Délai restant : ${c.delaiRestant} jour(s) (${NIVEAU_LABELS[c.niveau]})`,
    `Statut : ${STATUT_LABELS[d.statut]}`,
    `Analyste traitant : ${d.analyste ?? "non attribué"}`,
    `Pièces :\n${pieces}`,
    d.observations ? `Observations : ${d.observations}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Analyse déterministe, utilisée sans clé API ou en repli. */
export function analyseLocale(d: Dossier): string {
  const c = calculerDelai(d.dateReception, d.delaiReglementaire);
  const manquantes = d.pieces.filter((p) => !p.fourni);
  const complet = manquantes.length === 0;
  const lignes: string[] = [];

  lignes.push(`**1. Qualification** — ${TYPE_LABELS[d.type]} présenté par ${d.demandeur} (${d.reference}), montant ${d.montant.toLocaleString("fr-FR")} ${d.devise}.`);
  lignes.push(
    complet
      ? `**2. Pièces** — Dossier complet : ${d.pieces.length}/${d.pieces.length} pièces fournies.`
      : `**2. Pièces** — Dossier incomplet : ${manquantes.length} pièce(s) manquante(s) : ${manquantes.map((p) => p.label).join(", ")}.`,
  );
  const delaiTxt =
    c.delaiRestant < 0
      ? `délai réglementaire dépassé de ${-c.delaiRestant} jour(s)`
      : `il reste ${c.delaiRestant} jour(s) sur ${d.delaiReglementaire} (échéance ${formatDateFR(c.echeance)})`;
  lignes.push(`**3. Conformité des délais** — Reçu le ${formatDateFR(d.dateReception)}, J+${c.joursEcoules} : ${delaiTxt}. Niveau : ${NIVEAU_LABELS[c.niveau]}.`);

  let decision: string;
  if (d.statut === "valide" || d.statut === "rejete") decision = `Dossier déjà clos (${STATUT_LABELS[d.statut]}) ; aucune action requise.`;
  else if (!complet) decision = "Mise en attente de pièces et notification du demandeur ; le délai continue de courir.";
  else if (c.niveau === "depasse") decision = "Décision immédiate à soumettre à la hiérarchie avec mention du dépassement de délai.";
  else if (c.niveau === "urgent") decision = "Transmission prioritaire à la hiérarchie pour décision avant l'échéance.";
  else decision = "Poursuite de l'instruction ; proposition de validation à préparer.";
  lignes.push(`**4. Décision proposée** — ${decision}`);
  if (!d.analyste) lignes.push("**Alerte** — Aucun analyste attribué : à affecter par la hiérarchie.");
  return lignes.join("\n\n");
}

const MODELES = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-1.5-flash"];
const SYSTEM =
  "Tu es Ora, assistante du Service des Autorisations de la Direction de la Réglementation des Changes (BEAC). " +
  "Réponds en français, de façon structurée et sourcée sur les données fournies : 1. Qualification, 2. Pièces, 3. Conformité des délais, 4. Décision proposée. " +
  "Reprends exactement le délai restant fourni ; ne le recalcule pas.";

async function appelGemini(apiKey: string, prompt: string, signal?: AbortSignal): Promise<string> {
  let derniereErreur = "";
  for (const modele of MODELES) {
    for (let tentative = 0; tentative < 2; tentative++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          }),
        },
      );
      if (res.ok) {
        const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        if (text.trim()) return text;
        derniereErreur = `${modele} : réponse vide`;
        break;
      }
      derniereErreur = `${modele} : HTTP ${res.status}`;
      if (res.status === 503 || res.status === 429) {
        await new Promise((r) => setTimeout(r, 800 * (tentative + 1)));
        continue; // modèle saturé : nouvelle tentative
      }
      break; // autre erreur : modèle suivant
    }
  }
  throw new Error(derniereErreur || "Gemini indisponible");
}

export async function demanderOra(
  question: string,
  dossier: Dossier | null,
  signal?: AbortSignal,
): Promise<OraMessage> {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
  const prompt = dossier ? `Dossier :\n${contexteDossier(dossier)}\n\nQuestion : ${question}` : question;

  if (apiKey) {
    try {
      const content = await appelGemini(apiKey, prompt, signal);
      return { role: "ora", content, source: "gemini" };
    } catch {
      /* repli local ci-dessous */
    }
  }
  if (dossier) return { role: "ora", content: analyseLocale(dossier), source: "local" };
  return {
    role: "ora",
    content:
      "Sélectionnez un dossier du registre pour que je le vérifie (qualification, pièces, conformité des délais, décision proposée). " +
      (apiKey ? "" : "Aucune clé Gemini configurée : je fonctionne en mode local."),
    source: "local",
  };
}
