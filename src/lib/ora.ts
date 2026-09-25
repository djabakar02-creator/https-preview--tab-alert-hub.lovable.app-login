import { SYSTEM_ORA } from "../../shared/ora-persona.mjs";
import { formatDateFR } from "./dates";
import { delaiDuDossier, NIVEAU_LABELS } from "./delais";
import { STATUT_LABELS, TYPE_LABELS, type Dossier } from "./dossiers";

/* ------------------------------------------------------------------ */
/* Clé Google AI Studio                                                 */
/* ------------------------------------------------------------------ */

/**
 * Clé Google AI Studio, injectée au build depuis VITE_GEMINI_API_KEY
 * (fichier .env en local, variable d'environnement chez l'hébergeur).
 *
 * Elle n'est volontairement pas écrite dans le code : une application web sert
 * son code au navigateur, et ce dépôt est public. La clé resterait donc lisible
 * par n'importe qui, et la protection contre les secrets de GitHub refuse un
 * tel commit. Voir le README, section « Clé Gemini ».
 *
 * Sans clé, Ora reste opérationnelle : elle répond via Claude sur une page
 * publiée, sinon via l'analyse locale déterministe.
 */
function cleGemini(): string {
  /* VITE_SANS_CLE=1 : build de démonstration pour hébergement tiers. */
  if (import.meta.env.VITE_SANS_CLE === "1") return "";
  return (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() ?? "";
}

/** Modèles essayés dans l'ordre (vérifiés disponibles sur l'API v1beta). */
const MODELES = ["gemini-flash-latest", "gemini-3.6-flash", "gemini-2.5-flash"];

/* ------------------------------------------------------------------ */
/* Identité et compétences d'Ora                                        */
/* ------------------------------------------------------------------ */

export { ORA, ORA_COMPETENCES, ORA_SUGGESTIONS } from "../../shared/ora-persona.mjs";


/* ------------------------------------------------------------------ */
/* Contexte transmis au modèle                                          */
/* ------------------------------------------------------------------ */

export function contexteDossier(d: Dossier): string {
  const c = delaiDuDossier(d);
  const pieces = d.pieces.map((p) => `- ${p.label} : ${p.fourni ? "fournie" : "MANQUANTE"}`).join("\n");
  const clos = d.statut === "valide" || d.statut === "rejete";
  return [
    `Référence : ${d.reference}`,
    `Demandeur : ${d.demandeur}`,
    `Type : ${TYPE_LABELS[d.type]}`,
    `Montant : ${d.montant ? `${d.montant.toLocaleString("fr-FR")} ${d.devise}` : "non renseigné"}`,
    `Date de réception par la Banque Centrale : ${formatDateFR(d.dateReception)}`,
    `Délai réglementaire retenu : ${d.delaiReglementaire} jours`,
    `Jours écoulés : J+${c.joursEcoules}`,
    `Échéance : ${formatDateFR(c.echeance)}`,
    clos
      ? `Délai restant : sans objet, dossier clos`
      : `Délai restant : ${c.delaiRestant} jour(s) — niveau ${NIVEAU_LABELS[c.niveau]}`,
    `Statut : ${STATUT_LABELS[d.statut]}`,
    `Analyste traitant : ${d.analyste ?? "non attribué"}`,
    `Pièces du dossier :\n${pieces}`,
    d.observations ? `Observations de l'agent : ${d.observations}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Analyse locale déterministe (dernier recours, toujours disponible)   */
/* ------------------------------------------------------------------ */

export function analyseLocale(d: Dossier): string {
  const c = delaiDuDossier(d);
  const manquantes = d.pieces.filter((p) => !p.fourni);
  const complet = manquantes.length === 0;
  const clos = d.statut === "valide" || d.statut === "rejete";
  const l: string[] = [];

  l.push(
    `**1. Qualification** — ${TYPE_LABELS[d.type]} présentée par ${d.demandeur} (${d.reference})` +
      (d.montant ? `, pour un montant de ${d.montant.toLocaleString("fr-FR")} ${d.devise}` : "") +
      ". Instruction relevant du Service des Autorisations au titre de la réglementation des changes CEMAC.",
  );
  l.push(
    complet
      ? `**2. Pièces** — Dossier complet : ${d.pieces.length} pièce(s) sur ${d.pieces.length} fournies.`
      : `**2. Pièces** — **Dossier incomplet** : ${manquantes.length} pièce(s) manquante(s) — ${manquantes.map((p) => p.label).join(", ")}.`,
  );
  const delai = clos
    ? "dossier clos, le décompte est sans objet"
    : c.delaiRestant < 0
      ? `**délai réglementaire dépassé de ${-c.delaiRestant} jour(s)**`
      : `il reste ${c.delaiRestant} jour(s) sur ${d.delaiReglementaire} (échéance le ${formatDateFR(c.echeance)})`;
  l.push(
    `**3. Conformité des délais** — Reçu le ${formatDateFR(d.dateReception)}, soit J+${c.joursEcoules} : ${delai}. Niveau : ${clos ? "clos" : NIVEAU_LABELS[c.niveau]}.`,
  );

  let decision: string;
  if (clos) decision = `Dossier déjà clos (${STATUT_LABELS[d.statut]}). Aucune diligence complémentaire n'est requise.`;
  else if (!complet)
    decision = "Mettre le dossier en attente de pièces et notifier le demandeur sans délai. Le décompte réglementaire continue de courir.";
  else if (c.niveau === "depasse")
    decision = "Soumettre une décision à la hiérarchie sans délai, en mentionnant expressément le dépassement constaté.";
  else if (c.niveau === "urgent") decision = "Transmettre en priorité à la hiérarchie pour décision avant l'échéance.";
  else decision = "Poursuivre l'instruction et préparer une proposition de validation.";
  l.push(`**4. Décision proposée** — ${decision}`);

  if (!d.analyste) l.push("**Point de vigilance** — Aucun analyste traitant n'est attribué : affectation à demander à la hiérarchie.");
  l.push(NOTE_LOCALE);
  return l.join("\n\n");
}

const NOTE_LOCALE =
  "_Analyse locale déterministe : moteur conversationnel indisponible. Les constats ci-dessus proviennent des seules données du registre._";

const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Repli hors ligne : répond au point demandé à partir des seules données du
 * registre, au lieu de resservir l'analyse complète à chaque question.
 */
export function reponseLocale(question: string, d: Dossier): string {
  const q = sansAccent(question);
  const c = delaiDuDossier(d);
  const manquantes = d.pieces.filter((p) => !p.fourni);
  const clos = d.statut === "valide" || d.statut === "rejete";
  const a = (corps: string) => `${corps}\n\n${NOTE_LOCALE}`;

  /* Une demande de vérification globale prime sur les intentions ciblées :
     « vérifie ce dossier complet » nomme aussi les pièces et les délais. */
  if (/verifie|analyse|examine|instrui|controle|passe en revue/.test(q)) return analyseLocale(d);

  if (/piece|manqu|reclam|justificatif/.test(q)) {
    if (manquantes.length === 0)
      return a(
        `**Pièces** — Le dossier ${d.reference} est complet : les ${d.pieces.length} pièces requises pour une demande « ${TYPE_LABELS[d.type]} » sont fournies. Aucune pièce n'est à réclamer.`,
      );
    return a(
      `**Pièces à réclamer au demandeur ${d.demandeur}** (dossier ${d.reference}) :\n\n` +
        manquantes.map((p) => `- ${p.label}`).join("\n") +
        `\n\nSoit ${manquantes.length} pièce(s) sur ${d.pieces.length}. ` +
        (clos
          ? "Le dossier étant clos, cette réclamation est sans objet."
          : `Le décompte réglementaire continue de courir pendant l'attente : il reste ${c.delaiRestant} jour(s) avant l'échéance du ${formatDateFR(c.echeance)}.`),
    );
  }

  if (/delai|echeance|retard|depass|temps|urgen|quand/.test(q)) {
    if (clos)
      return a(`**Délais** — Le dossier ${d.reference} est clos (${STATUT_LABELS[d.statut]}) : le décompte réglementaire est sans objet.`);
    const etat =
      c.delaiRestant < 0
        ? `**le délai réglementaire est dépassé de ${-c.delaiRestant} jour(s)**`
        : `il reste **${c.delaiRestant} jour(s)**`;
    return a(
      `**Délais** — Reçu le ${formatDateFR(d.dateReception)}, le dossier ${d.reference} est à J+${c.joursEcoules} sur un délai réglementaire de ${d.delaiReglementaire} jours. Échéance : ${formatDateFR(c.echeance)}, donc ${etat}. Niveau retenu par le registre : ${NIVEAU_LABELS[c.niveau]}.`,
    );
  }

  if (/decision|proposition|redige|motiv|valider|rejeter|conclusion/.test(q)) {
    const analyse = analyseLocale(d);
    return analyse.slice(analyse.indexOf("**4. Décision proposée**"));
  }

  return a(
    `Je ne peux pas traiter une question libre : mon moteur conversationnel est injoignable. ` +
      `Sur le dossier ${d.reference} (${d.demandeur}), je peux vous restituer hors ligne : les pièces manquantes, l'état des délais, ou la décision proposée. ` +
      `Reformulez en ce sens, ou utilisez une des demandes fréquentes.`,
  );
}

/* ------------------------------------------------------------------ */
/* Moteurs conversationnels                                             */
/* ------------------------------------------------------------------ */

export type Moteur = "service" | "claude" | "gemini" | "local";

export interface OraMessage {
  role: "user" | "ora";
  content: string;
  moteur?: Moteur;
}

interface Options {
  signal?: AbortSignal;
  onText?: (texte: string) => void;
  /** Délai de garde par appel réseau, en millisecondes (défaut : 20 000). */
  timeoutMs?: number;
}

type SampleFn = (
  input: { role: "user" | "assistant"; content: string }[],
  opts?: { signal?: AbortSignal; cache?: boolean; onText?: (e: { text: string }) => void },
) => Promise<{ text: string }>;

declare global {
  interface Window {
    claude?: { use?: (name: string) => Promise<unknown> };
  }
}

/** Moteur 1 : Claude, via la capacité `sample` d'une page publiée. */
async function viaClaude(
  tours: { role: "user" | "assistant"; content: string }[],
  o: Options,
): Promise<string | null> {
  if (typeof window === "undefined" || !window.claude?.use) return null;
  let sample: SampleFn | null = null;
  try {
    sample = (await window.claude.use("sample")) as SampleFn | null;
  } catch {
    return null;
  }
  if (typeof sample !== "function") return null;
  const res = await sample([{ role: "user", content: SYSTEM_ORA }, ...tours], {
    signal: o.signal,
    cache: false,
    onText: o.onText ? ({ text }) => o.onText!(text) : undefined,
  });
  return res.text?.trim() || null;
}

/** Délai de garde par défaut : au-delà, on passe au moteur suivant. */
const TIMEOUT_MS = 20_000;

/**
 * Signal combinant l'annulation par l'utilisateur et un délai de garde,
 * pour qu'un réseau qui ne répond pas ne fige jamais la conversation.
 */
function signalAvecDelai(parent: AbortSignal | undefined, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("timeout", "TimeoutError")), ms);
  const relais = () => ctrl.abort(parent?.reason);
  if (parent) {
    if (parent.aborted) relais();
    else parent.addEventListener("abort", relais, { once: true });
  }
  return {
    signal: ctrl.signal,
    fin: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", relais);
    },
  };
}

/**
 * Moteur 1 bis : le service Ora (server/index.mjs), qui détient la clé.
 * C'est la voie recommandée en déploiement : le navigateur n'a aucun secret.
 * Absent en développement pur ou sur une page statique : on passe alors au
 * moteur suivant.
 */
async function viaService(
  tours: { role: "user" | "assistant"; content: string }[],
  o: Options,
): Promise<string | null> {
  const garde = signalAvecDelai(o.signal, o.timeoutMs ?? TIMEOUT_MS);
  try {
    const res = await fetch("/api/ora", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: garde.signal,
      body: JSON.stringify({ tours }),
    });
    if (res.status === 404 || res.status === 405) return null; // pas de service ici
    const json = (await res.json().catch(() => null)) as { texte?: string; erreur?: string } | null;
    if (!res.ok) {
      /* 503 : service présent mais sans clé — on laisse la chaîne continuer. */
      if (res.status === 503) return null;
      throw new Error(json?.erreur ?? "Le service Ora a renvoyé une erreur.");
    }
    return json?.texte?.trim() || null;
  } catch (e) {
    if (o.signal?.aborted) throw e;
    if (e instanceof Error && e.message.startsWith("Le service")) throw e;
    return null; // service injoignable : moteur suivant
  } finally {
    garde.fin();
  }
}

/** Moteur 2 : Gemini (Google AI Studio), plusieurs modèles avec reprise sur saturation. */
async function viaGemini(
  tours: { role: "user" | "assistant"; content: string }[],
  o: Options,
): Promise<string | null> {
  const key = cleGemini();
  if (!key) return null;
  const contents = tours.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.content }],
  }));

  for (const modele of MODELES) {
    for (let essai = 0; essai < 2; essai++) {
      const garde = signalAvecDelai(o.signal, o.timeoutMs ?? TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: garde.signal,
            body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_ORA }] }, contents }),
          },
        );
      } catch (e) {
        /* Annulation demandée par l'utilisateur : on remonte. Délai de garde
           dépassé, réseau bloqué ou hors ligne : on bascule sur l'analyse locale. */
        if (o.signal?.aborted) throw e;
        return null;
      } finally {
        garde.fin();
      }
      if (res.ok) {
        const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const texte = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        if (texte.trim()) return texte.trim();
        break; // réponse vide : modèle suivant
      }
      if (res.status === 503 || res.status === 429) {
        await new Promise((r) => setTimeout(r, 800 * (essai + 1)));
        continue; // modèle saturé : nouvelle tentative
      }
      break; // 400/403/404 : modèle suivant
    }
  }
  return null;
}

/**
 * Interroge Ora. Trois moteurs essayés dans l'ordre : Claude (page publiée),
 * Gemini (application déployée), puis analyse locale déterministe.
 */
export async function demanderOra(
  question: string,
  dossier: Dossier | null,
  historique: OraMessage[] = [],
  o: Options = {},
): Promise<OraMessage> {
  const tours: { role: "user" | "assistant"; content: string }[] = [];
  if (dossier) {
    tours.push({
      role: "user",
      content: `Dossier en cours d'examen :\n\n${contexteDossier(dossier)}`,
    });
    tours.push({ role: "assistant", content: "Dossier reçu. Je vous écoute." });
  }
  /* Les 10 derniers échanges suffisent au fil de la conversation. */
  for (const m of historique.slice(-10)) {
    tours.push({ role: m.role === "user" ? "user" : "assistant", content: m.content });
  }
  tours.push({ role: "user", content: question });

  try {
    const parClaude = await viaClaude(tours, o);
    if (parClaude) return { role: "ora", content: parClaude, moteur: "claude" };
  } catch (e) {
    if ((e as Error).name === "AbortError" || (e as { code?: string }).code === "cancelled") throw e;
  }

  try {
    const parService = await viaService(tours, o);
    if (parService) return { role: "ora", content: parService, moteur: "service" };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
  }

  try {
    const parGemini = await viaGemini(tours, o);
    if (parGemini) return { role: "ora", content: parGemini, moteur: "gemini" };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
  }

  if (dossier) return { role: "ora", content: reponseLocale(question, dossier), moteur: "local" };
  return {
    role: "ora",
    content:
      "Je ne parviens pas à joindre mon moteur conversationnel et aucun dossier n'est sélectionné. " +
      "Choisissez un dossier dans le registre : je pourrai alors en produire l'analyse à partir des seules données enregistrées.",
    moteur: "local",
  };
}
