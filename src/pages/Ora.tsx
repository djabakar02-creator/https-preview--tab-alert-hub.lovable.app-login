import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { demanderOra, type OraMessage } from "../lib/ora";
import { useDossiers } from "../lib/dossiers";
import { calculerDelai } from "../lib/delais";
import { Section } from "../components/ui";

function Rendu({ text }: { text: string }) {
  /* Mise en forme minimale : paragraphes, **gras**, listes « - ». */
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className={para.trim().startsWith("- ") ? "pl-4" : ""}>
          {para.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
            seg.startsWith("**") ? <strong key={j}>{seg.slice(2, -2)}</strong> : <span key={j}>{seg}</span>,
          )}
        </p>
      ))}
    </div>
  );
}

export default function Ora() {
  const dossiers = useDossiers();
  const [params] = useSearchParams();
  const [dossierId, setDossierId] = useState<string>(params.get("dossier") ?? "");
  const [question, setQuestion] = useState("Vérifie ce dossier complet : qualification, pièces, conformité des délais et décision proposée.");
  const [messages, setMessages] = useState<OraMessage[]>([]);
  const [enCours, setEnCours] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bas.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => () => abort.current?.abort(), []);

  const dossier = dossiers.find((d) => d.id === dossierId) ?? null;
  const calc = dossier ? calculerDelai(dossier.dateReception, dossier.delaiReglementaire) : null;
  const cle = Boolean((import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim());

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || enCours) return;
    setMessages((m) => [...m, { role: "user", content: dossier ? `[${dossier.reference}] ${q}` : q }]);
    setEnCours(true);
    abort.current = new AbortController();
    try {
      const rep = await demanderOra(q, dossier, abort.current.signal);
      setMessages((m) => [...m, rep]);
    } catch (err) {
      setMessages((m) => [...m, { role: "ora", content: `Erreur : ${(err as Error).message}`, source: "local" }]);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps text-rouge mb-1">Ora</p>
        <h1 className="font-display text-3xl">Assistante d'instruction</h1>
        <p className="text-sm mt-2 opacity-70">
          {cle ? "Moteur : Google AI Studio (Gemini) avec repli local." : "Moteur : analyse locale (aucune clé Gemini configurée — voir .env.example)."}
        </p>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <Section title="Dossier à vérifier">
          <select className="field" value={dossierId} onChange={(e) => setDossierId(e.target.value)} aria-label="Dossier">
            <option value="">— Aucun (question libre) —</option>
            {dossiers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.reference} · {d.demandeur}
              </option>
            ))}
          </select>
          {dossier && calc && (
            <dl className="mt-4 text-sm space-y-1">
              <div className="flex justify-between">
                <dt className="opacity-70">Jours écoulés</dt>
                <dd className="font-bold tabular-nums">J+{calc.joursEcoules}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="opacity-70">Délai restant</dt>
                <dd className={`font-bold tabular-nums ${calc.delaiRestant <= 3 ? "text-rouge" : ""}`}>{calc.delaiRestant} j</dd>
              </div>
              <div className="flex justify-between">
                <dt className="opacity-70">Pièces</dt>
                <dd className="font-bold tabular-nums">
                  {dossier.pieces.filter((p) => p.fourni).length}/{dossier.pieces.length}
                </dd>
              </div>
            </dl>
          )}
          <p className="text-xs opacity-60 mt-4">Ora reprend le délai restant calculé en temps réel par le registre ; elle ne le recalcule pas.</p>
        </Section>

        <Section title="Conversation">
          <div className="min-h-[320px] max-h-[520px] overflow-y-auto space-y-4 pr-1">
            {messages.length === 0 && <p className="text-sm opacity-60 italic">Choisissez un dossier puis posez votre question.</p>}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <p className="label-caps text-[9px] opacity-60 mb-1">
                  {m.role === "user" ? "Vous" : `Ora${m.source ? ` · ${m.source === "gemini" ? "Gemini" : "local"}` : ""}`}
                </p>
                <div className={`inline-block text-left max-w-[90%] px-4 py-3 border ${m.role === "user" ? "bg-ink text-white border-ink" : "bg-white border-ink/40"}`}>
                  <Rendu text={m.content} />
                </div>
              </div>
            ))}
            {enCours && <p className="text-sm opacity-60 animate-pulse">Ora analyse…</p>}
            <div ref={bas} />
          </div>
          <form onSubmit={envoyer} className="mt-4 flex gap-2">
            <input className="field" value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="Question" />
            <button type="submit" className="btn-ghost shrink-0" disabled={enCours || !question.trim()}>
              Envoyer
            </button>
          </form>
        </Section>
      </div>
    </div>
  );
}
