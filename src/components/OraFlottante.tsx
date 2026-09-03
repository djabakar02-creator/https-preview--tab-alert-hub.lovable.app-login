import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { useUser } from "../App";
import { useDossiers } from "../lib/dossiers";
import { ORA, ORA_SUGGESTIONS } from "../lib/ora";
import {
  basculerOra,
  definirDossierOra,
  envoyerOra,
  fermerOra,
  interrompreOra,
  nouvelleConversationOra,
  useOraConversation,
} from "../lib/ora-conversation";
import OraAvatar from "./OraAvatar";
import OraRendu, { MOTEUR_LABELS } from "./OraRendu";

/**
 * Ora, présente sur chaque page comme un agent à part entière plutôt qu'un
 * onglet qu'il faut aller chercher : une bulle repliée, un panneau qui se
 * déplie par-dessus le contenu sans y naviguer. Conversation partagée avec la
 * page /ora (src/lib/ora-conversation.ts) : l'ouvrir ici puis y aller plus tard
 * retrouve les mêmes échanges.
 *
 * Masquée sur /ora elle-même : la page dédiée est déjà Ora, en plein écran.
 */
export default function OraFlottante() {
  const { pathname } = useLocation();
  const user = useUser();
  const dossiers = useDossiers();
  const { ouvert, dossierId, messages, partiel, enCours } = useOraConversation();
  const [question, setQuestion] = useState("");
  const [suggestions, setSuggestions] = useState(false);
  const bas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ouvert) bas.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, partiel, ouvert]);

  if (pathname === "/ora") return null;

  const dossier = dossiers.find((d) => d.id === dossierId) ?? null;

  function envoyer(texte: string) {
    if (!texte.trim()) return;
    envoyerOra(texte, dossier);
    setQuestion("");
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {ouvert && (
        <div className="card w-[min(400px,calc(100vw-2rem))] border-t-[5px] border-t-rouge shadow-[0_12px_36px_rgba(0,0,0,0.28)] flex flex-col max-h-[min(640px,calc(100vh-7rem))]">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-line shrink-0">
            <OraAvatar size={32} actif={enCours} />
            <div className="flex-1 min-w-0">
              <p className="font-display text-base leading-none truncate">{ORA.nom}</p>
              <p className="text-[10px] text-muted uppercase tracking-[0.1em] mt-0.5">{ORA.fonction}</p>
            </div>
            <Link to="/ora" className="btn-sm shrink-0" onClick={fermerOra} title="Ouvrir en plein écran">
              Plein écran
            </Link>
            <button type="button" className="btn-sm shrink-0" onClick={fermerOra} aria-label="Réduire Ora">
              Réduire
            </button>
          </div>

          <div className="px-4 pt-3 shrink-0">
            <select
              className="field text-xs"
              value={dossierId}
              onChange={(e) => definirDossierOra(e.target.value)}
              aria-label="Dossier"
            >
              <option value="">— Aucun dossier (question générale) —</option>
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.reference} · {d.demandeur}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[160px]">
            {messages.length === 0 && !enCours && (
              <div className="flex gap-2.5 items-start">
                <OraAvatar size={28} />
                <div className="border border-ink/35 bg-card px-3 py-2.5 text-sm leading-relaxed">
                  Bonjour {user.displayName}. Choisissez un dossier ou posez directement une question.
                  <button type="button" className="block text-xs font-bold text-rouge mt-2" onClick={() => setSuggestions((s) => !s)}>
                    {suggestions ? "Masquer les suggestions" : "Voir des exemples de questions"}
                  </button>
                </div>
              </div>
            )}

            {suggestions && messages.length === 0 && (
              <ul className="space-y-1.5 pl-[38px]">
                {ORA_SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button type="button" className="btn-liste text-xs" disabled={enCours} onClick={() => envoyer(s)}>
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="text-right">
                  <div className="inline-block text-left bg-fort text-sur-fort px-3 py-2 text-sm leading-relaxed max-w-[88%]">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-2.5 items-start">
                  <OraAvatar size={28} />
                  <div className="max-w-[88%]">
                    <p className="label-caps text-[9px] text-muted mb-1">
                      {ORA.nom}
                      {m.moteur ? ` · ${MOTEUR_LABELS[m.moteur]}` : ""}
                    </p>
                    <div className="border border-ink/35 bg-card px-3 py-2">
                      <OraRendu text={m.content} />
                    </div>
                  </div>
                </div>
              ),
            )}

            {enCours && (
              <div className="flex gap-2.5 items-start">
                <OraAvatar size={28} actif />
                <div className="max-w-[88%] border border-ink/35 bg-card px-3 py-2">
                  {partiel ? <OraRendu text={partiel} /> : <p className="text-sm text-muted">Instruction en cours…</p>}
                </div>
              </div>
            )}
            <div ref={bas} />
          </div>

          <div className="border-t border-line px-4 py-3 shrink-0">
            {messages.length > 0 && (
              <button type="button" className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted hover:text-rouge mb-2" disabled={enCours} onClick={nouvelleConversationOra}>
                Nouvelle conversation
              </button>
            )}
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                envoyer(question);
              }}
              className="flex gap-2"
            >
              <input
                className="field text-sm"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Votre question…"
                aria-label="Votre question à Ora"
              />
              {enCours ? (
                <button type="button" className="btn-ghost shrink-0" onClick={interrompreOra}>
                  Stop
                </button>
              ) : (
                <button type="submit" className="btn-fort shrink-0" disabled={!question.trim()}>
                  Envoyer
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={basculerOra}
        aria-label={ouvert ? "Fermer Ora" : "Ouvrir Ora, assistante d'instruction"}
        aria-expanded={ouvert}
        title="Ora — assistante d'instruction"
        className="relative flex items-center gap-2.5 border border-line bg-card pl-2 pr-4 py-2 shadow-[0_6px_20px_rgba(0,0,0,0.22)] hover:border-rouge transition-colors"
      >
        <OraAvatar size={36} actif={enCours} />
        <span className="text-xs font-bold uppercase tracking-[0.12em]">{ouvert ? "Fermer" : "Ora"}</span>
        {!ouvert && enCours && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rouge border-2 border-paper rounded-full" aria-hidden="true" />}
      </button>
    </div>
  );
}
