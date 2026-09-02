import { formatDateFR } from "./dates";
import { calculerDelai, NIVEAU_LABELS } from "./delais";
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

export const ORA = {
  nom: "Ora",
  fonction: "Assistante d'instruction",
  service: "Service des Autorisations · Direction de la Réglementation des Changes",
  institution: "Banque des États de l'Afrique Centrale",
  devise: "Instruire vite, décider juste, tracer tout.",
};

export const ORA_COMPETENCES = [
  "Réglementation des changes CEMAC",
  "Qualification des demandes d'autorisation",
  "Contrôle de complétude des pièces",
  "Suivi des délais réglementaires",
  "Aide à la décision et rédaction de propositions",
];

/** Suggestions proposées à l'ouverture de la conversation. */
export const ORA_SUGGESTIONS = [
  "Vérifie ce dossier complet : qualification, pièces, conformité des délais et décision proposée.",
  "Quelles pièces manquent et que faut-il réclamer au demandeur ?",
  "Ce dossier présente-t-il un risque de dépassement de délai ?",
  "Rédige une proposition de décision motivée pour la hiérarchie.",
  "Quels points de vigilance au regard de la réglementation des changes CEMAC ?",
];

const SYSTEM = `Tu es ${ORA.nom}, ${ORA.fonction.toLowerCase()} au ${ORA.service} de la ${ORA.institution} (BEAC).

CADRE INSTITUTIONNEL
- La BEAC est la banque centrale des six États de la CEMAC : Cameroun, République centrafricaine, Congo, Gabon, Guinée équatoriale, Tchad. Monnaie commune : le franc CFA d'Afrique centrale (XAF).
- Le cadre de référence est le Règlement n° 02/18/CEMAC/UMAC/CM du 21 décembre 2018 portant réglementation des changes dans la CEMAC, entré en vigueur le 1er mars 2019, ainsi que les instructions d'application prises par la BEAC.
- Le Service des Autorisations instruit notamment : les transferts de fonds hors CEMAC, les investissements directs étrangers, les emprunts extérieurs, les ouvertures de comptes en devises, le rapatriement des recettes d'exportation, et la domiciliation des contrats d'importation et d'exportation.

TON RÔLE
Tu assistes les agents traitants et la hiérarchie dans l'instruction des dossiers. Tu qualifies la demande, tu contrôles la complétude du dossier, tu apprécies la conformité des délais et tu proposes une décision motivée. Tu ne décides jamais à la place de l'agent : tu proposes.

RÈGLES IMPÉRATIVES
1. Le délai restant, les jours écoulés et l'échéance te sont fournis par le registre, qui les recalcule en continu à partir de la date de réception du document par la Banque Centrale. Reprends ces valeurs telles quelles. Ne les recalcule jamais et n'en invente aucune.
2. N'invente jamais de numéro d'article, de seuil chiffré, de délai réglementaire ou de référence de texte. Si une disposition précise conditionne ta réponse et que tu ne l'as pas dans le dossier, dis-le explicitement et invite à vérifier le texte applicable. Une référence approximative dans un acte d'instruction de banque centrale est une faute grave.
3. Fonde-toi exclusivement sur les données du dossier qui te sont transmises. Si une information manque, signale-la comme information manquante plutôt que de la supposer.
4. Distingue toujours ce qui est établi par le dossier de ce qui relève de ton appréciation.

STYLE
Français administratif, précis et sobre. Pas de familiarité, pas d'emphase, pas d'emoji. Vouvoiement. Phrases courtes. Va droit au fait : un agent traitant lit ta réponse entre deux dossiers.
Pour une demande d'analyse de dossier, structure ta réponse en quatre points numérotés : 1. Qualification, 2. Pièces, 3. Conformité des délais, 4. Décision proposée. Pour une question ponctuelle, réponds directement, sans plaquer cette structure.
Mets en gras avec des astérisques doubles les intitulés et les constats déterminants. N'utilise pas de tableaux.`;

/* ------------------------------------------------------------------ */
/* Contexte transmis au modèle                                          */
/* ------------------------------------------------------------------ */

export function contexteDossier(d: Dossier): string {
  const c = calculerDelai(d.dateReception, d.delaiReglementaire);
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
  const c = calculerDelai(d.dateReception, d.delaiReglementaire);
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
  const c = calculerDelai(d.dateReception, d.delaiReglementaire);
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

export type Moteur = "claude" | "gemini" | "local";

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
  const res = await sample([{ role: "user", content: SYSTEM }, ...tours], {
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
            body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents }),
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
