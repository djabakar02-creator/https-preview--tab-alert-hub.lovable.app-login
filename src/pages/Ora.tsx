import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useUser } from "../App";
import { delaiDuDossier } from "../lib/delais";
import { useDossiers } from "../lib/dossiers";
import { ORA, ORA_COMPETENCES, ORA_SUGGESTIONS } from "../lib/ora";
import {
  definirDossierOra,
  envoyerOra,
  interrompreOra,
  nouvelleConversationOra,
  useOraConversation,
} from "../lib/ora-conversation";
import OraAvatar from "../components/OraAvatar";
import OraRendu, { MOTEUR_LABELS } from "../components/OraRendu";
import { Section } from "../components/ui";

/**
 * Espace de travail complet d'Ora : le même agent que la bulle flottante
 * (visible depuis toutes les pages), en plein écran pour un examen de dossier
 * qui mérite plus de place. Les deux partagent la même conversation.
 */
export default function Ora() {
  const user = useUser();
  const dossiers = useDossiers();
  const [params] = useSearchParams();
  const { dossierId, messages, partiel, enCours } = useOraConversation();
  const [question, setQuestion] = useState("");
  const bas = useRef<HTMLDivElement>(null);

  /* Un lien « Vérifier avec Ora » depuis le registre présélectionne son dossier. */
  useEffect(() => {
    const d = params.get("dossier");
    if (d) definirDossierOra(d);
  }, [params]);

  useEffect(() => {
    bas.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, partiel]);

  const dossier = dossiers.find((d) => d.id === dossierId) ?? null;
  const calc = dossier ? delaiDuDossier(dossier) : null;

  return (
    <div className="space-y-6">
      {/* Carte d'identité d'Ora */}
      <div className="card border-t-[5px] border-t-rouge p-5 flex flex-wrap items-start gap-5">
        <OraAvatar size={56} actif={enCours} />
        <div className="flex-1 min-w-[240px]">
          <p className="label-caps text-rouge">{ORA.fonction}</p>
          <h1 className="font-display text-3xl mt-0.5">{ORA.nom}</h1>
          <p className="text-sm mt-1 text-muted">{ORA.service}</p>
          <p className="text-sm italic text-muted mt-2">« {ORA.devise} »</p>
        </div>
        <ul className="flex flex-wrap gap-1.5 max-w-[520px]">
          {ORA_COMPETENCES.map((c) => (
            <li key={c} className="border border-ink/45 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <div className="space-y-6">
          <Section title="Dossier à examiner">
            <select className="field" value={dossierId} onChange={(e) => definirDossierOra(e.target.value)} aria-label="Dossier">
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
                  <dt className="text-muted">Jours écoulés</dt>
                  <dd className="font-bold tabular-nums">J+{calc.joursEcoules}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Délai restant</dt>
                  <dd className={`font-bold tabular-nums ${calc.delaiRestant <= 3 ? "text-rouge" : ""}`}>{calc.delaiRestant} j</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Pièces fournies</dt>
                  <dd className="font-bold tabular-nums">
                    {dossier.pieces.filter((p) => p.fourni).length}/{dossier.pieces.length}
                  </dd>
                </div>
              </dl>
            )}
            <p className="text-xs text-muted mt-4">
              Ora reprend le délai restant calculé en continu par le registre. Elle ne le recalcule pas et ne cite jamais de référence
              réglementaire qu'elle n'a pas dans le dossier.
            </p>
          </Section>

          <Section title="Questions fréquentes">
            <ul className="space-y-1.5">
              {ORA_SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button type="button" className="btn-liste" disabled={enCours} onClick={() => envoyerOra(s, dossier)}>
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
              <button type="button" className="btn-sm" disabled={enCours} onClick={nouvelleConversationOra}>
                Nouvelle conversation
              </button>
            )
          }
        >
          <div className="min-h-[340px] max-h-[540px] overflow-y-auto space-y-4 pr-1">
            {messages.length === 0 && !enCours && (
              <div className="flex gap-3 items-start">
                <OraAvatar size={36} />
                <div className="border border-ink/35 bg-card px-4 py-3 max-w-[90%]">
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
                  <p className="label-caps text-[9px] text-muted mb-1">Vous</p>
                  <div className="inline-block text-left bg-fort text-sur-fort px-4 py-3 max-w-[85%]">
                    <p className="text-sm leading-relaxed">{m.content}</p>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-3 items-start">
                  <OraAvatar size={36} />
                  <div className="max-w-[90%]">
                    <p className="label-caps text-[9px] text-muted mb-1">
                      {ORA.nom}
                      {m.moteur ? ` · ${MOTEUR_LABELS[m.moteur]}` : ""}
                    </p>
                    <div className="border border-ink/35 bg-card px-4 py-3">
                      <OraRendu text={m.content} />
                    </div>
                  </div>
                </div>
              ),
            )}

            {enCours && (
              <div className="flex gap-3 items-start">
                <OraAvatar size={36} actif />
                <div className="max-w-[90%]">
                  <p className="label-caps text-[9px] text-muted mb-1">{ORA.nom}</p>
                  <div className="border border-ink/35 bg-card px-4 py-3">
                    {partiel ? <OraRendu text={partiel} /> : <p className="text-sm text-muted">Instruction en cours…</p>}
                  </div>
                </div>
              </div>
            )}
            <div ref={bas} />
          </div>

          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (!question.trim()) return;
              envoyerOra(question, dossier);
              setQuestion("");
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
              <button type="button" className="btn-ghost shrink-0" onClick={interrompreOra}>
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
