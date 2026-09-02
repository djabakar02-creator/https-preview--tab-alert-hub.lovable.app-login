import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useUser } from "../App";
import { calculerDelai } from "../lib/delais";
import { useDossiers } from "../lib/dossiers";
import {
  demanderOra,
  ORA,
  ORA_COMPETENCES,
  ORA_SUGGESTIONS,
  type Moteur,
  type OraMessage,
} from "../lib/ora";
import OraAvatar from "../components/OraAvatar";
import { Section } from "../components/ui";

const MOTEUR_LABELS: Record<Moteur, string> = {
  service: "service BEAC",
  claude: "Claude",
  gemini: "Gemini",
  local: "analyse locale",
};

function Rendu({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text.split(/\n{2,}/).map((para, i) => {
        const italique = para.startsWith("_") && para.endsWith("_");
        const contenu = italique ? para.slice(1, -1) : para;
        return (
          <p key={i} className={italique ? "text-xs opacity-60 italic" : para.trimStart().startsWith("- ") ? "pl-4" : ""}>
            {contenu.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
              seg.startsWith("**") ? <strong key={j}>{seg.slice(2, -2)}</strong> : <span key={j}>{seg}</span>,
            )}
          </p>
        );
      })}
    </div>
  );
}

export default function Ora() {
  const user = useUser();
  const dossiers = useDossiers();
  const [params] = useSearchParams();
  const [dossierId, setDossierId] = useState(params.get("dossier") ?? "");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<OraMessage[]>([]);
  const [partiel, setPartiel] = useState("");
  const [enCours, setEnCours] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bas.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, partiel]);
  useEffect(() => () => abort.current?.abort(), []);

  const dossier = dossiers.find((d) => d.id === dossierId) ?? null;
  const calc = dossier ? calculerDelai(dossier.dateReception, dossier.delaiReglementaire) : null;

  async function envoyer(texte: string) {
    const q = texte.trim();
    if (!q || enCours) return;
    const historique = messages;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setQuestion("");
    setPartiel("");
    setEnCours(true);
    abort.current = new AbortController();
    try {
      const rep = await demanderOra(q, dossier, historique, {
        signal: abort.current.signal,
        onText: (t) => setPartiel(t),
      });
      setMessages((m) => [...m, rep]);
    } catch (err) {
      const e = err as { name?: string; code?: string; message?: string };
      if (e.name !== "AbortError" && e.code !== "cancelled") {
        setMessages((m) => [
          ...m,
          { role: "ora", content: `Je n'ai pas pu traiter votre demande : ${e.message ?? "erreur inconnue"}.`, moteur: "local" },
        ]);
      }
    } finally {
      setPartiel("");
      setEnCours(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Carte d'identité d'Ora */}
      <div className="card border-t-[5px] border-t-rouge p-5 flex flex-wrap items-start gap-5">
        <OraAvatar size={56} actif={enCours} />
        <div className="flex-1 min-w-[240px]">
          <p className="label-caps text-rouge">{ORA.fonction}</p>
          <h1 className="font-display text-3xl mt-0.5">{ORA.nom}</h1>
          <p className="text-sm mt-1 opacity-70">{ORA.service}</p>
          <p className="text-sm italic opacity-60 mt-2">« {ORA.devise} »</p>
        </div>
        <ul className="flex flex-wrap gap-1.5 max-w-[520px]">
          {ORA_COMPETENCES.map((c) => (
            <li key={c} className="border border-ink/50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <div className="space-y-6">
          <Section title="Dossier à examiner">
            <select className="field" value={dossierId} onChange={(e) => setDossierId(e.target.value)} aria-label="Dossier">
              <option value="">— Aucun (question générale) —</option>
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.reference} · {d.demandeur}
                </option>
              ))}
            </select>
            {dossier && calc && (
              <dl className="mt-4 text-sm space-y-1">
                <div className="flex justify-between gap-2">
                  <dt className="opacity-70">Jours écoulés</dt>
                  <dd className="font-bold tabular-nums">J+{calc.joursEcoules}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="opacity-70">Délai restant</dt>
                  <dd className={`font-bold tabular-nums ${calc.delaiRestant <= 3 ? "text-rouge" : ""}`}>{calc.delaiRestant} j</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="opacity-70">Pièces fournies</dt>
                  <dd className="font-bold tabular-nums">
                    {dossier.pieces.filter((p) => p.fourni).length}/{dossier.pieces.length}
                  </dd>
                </div>
              </dl>
            )}
            <p className="text-xs opacity-60 mt-4">
              Ora reprend le délai restant calculé en continu par le registre. Elle ne le recalcule pas et ne cite jamais de référence
              réglementaire qu'elle n'a pas dans le dossier.
            </p>
          </Section>

          <Section title="Questions fréquentes">
            <ul className="space-y-1.5">
              {ORA_SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className="text-left text-xs border border-ink/30 w-full px-2.5 py-2 hover:border-rouge hover:text-rouge transition disabled:opacity-40"
                    disabled={enCours}
                    onClick={() => envoyer(s)}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <Section
          title="Conversation"
          aside={
            messages.length > 0 && (
              <button type="button" className="btn-sm" disabled={enCours} onClick={() => setMessages([])}>
                Nouvelle conversation
              </button>
            )
          }
        >
          <div className="min-h-[340px] max-h-[540px] overflow-y-auto space-y-4 pr-1">
            {messages.length === 0 && !enCours && (
              <div className="flex gap-3 items-start">
                <OraAvatar size={36} />
                <div className="border border-ink/40 bg-white px-4 py-3 max-w-[90%]">
                  <p className="text-sm leading-relaxed">
                    Bonjour {user.displayName}. Je suis {ORA.nom}, {ORA.fonction.toLowerCase()} au Service des Autorisations.
                    Sélectionnez un dossier du registre, puis posez votre question ou utilisez une des demandes fréquentes.
                  </p>
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="text-right">
                  <p className="label-caps text-[9px] opacity-60 mb-1">Vous</p>
                  <div className="inline-block text-left bg-ink text-white px-4 py-3 max-w-[85%]">
                    <p className="text-sm leading-relaxed">{m.content}</p>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-3 items-start">
                  <OraAvatar size={36} />
                  <div className="max-w-[90%]">
                    <p className="label-caps text-[9px] opacity-60 mb-1">
                      {ORA.nom}
                      {m.moteur ? ` · ${MOTEUR_LABELS[m.moteur]}` : ""}
                    </p>
                    <div className="border border-ink/40 bg-white px-4 py-3">
                      <Rendu text={m.content} />
                    </div>
                  </div>
                </div>
              ),
            )}

            {enCours && (
              <div className="flex gap-3 items-start">
                <OraAvatar size={36} actif />
                <div className="max-w-[90%]">
                  <p className="label-caps text-[9px] opacity-60 mb-1">{ORA.nom}</p>
                  <div className="border border-ink/40 bg-white px-4 py-3">
                    {partiel ? <Rendu text={partiel} /> : <p className="text-sm opacity-60">Instruction en cours…</p>}
                  </div>
                </div>
              </div>
            )}
            <div ref={bas} />
          </div>

          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              envoyer(question);
            }}
            className="mt-4 flex gap-2"
          >
            <input
              className="field"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={dossier ? `Votre question sur ${dossier.reference}…` : "Votre question…"}
              aria-label="Votre question"
            />
            {enCours ? (
              <button type="button" className="btn-ghost shrink-0" onClick={() => abort.current?.abort()}>
                Interrompre
              </button>
            ) : (
              <button type="submit" className="btn-ghost shrink-0" disabled={!question.trim()}>
                Envoyer
              </button>
            )}
          </form>
        </Section>
      </div>
    </div>
  );
}
