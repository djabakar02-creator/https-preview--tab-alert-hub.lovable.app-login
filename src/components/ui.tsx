import { useEffect, type ReactNode } from "react";
import { formatNombreFR } from "../lib/dates";
import { NIVEAU_LABELS, type Niveau } from "../lib/delais";
import { STATUT_LABELS, type Statut } from "../lib/dossiers";

const NIVEAU_CLASS: Record<Niveau, string> = {
  conforme: "bg-ok-fond text-ok border-ok",
  a_suivre: "bg-attention-fond text-attention border-attention",
  urgent: "bg-rouge/10 text-rouge border-rouge",
  depasse: "bg-fort text-sur-fort border-ink",
};

export function NiveauBadge({ niveau, clos }: { niveau: Niveau; clos?: boolean }) {
  if (clos)
    return (
      <span className="inline-block whitespace-nowrap border border-ink/35 text-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]">Clos</span>
    );
  return (
    <span className={`inline-block whitespace-nowrap border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${NIVEAU_CLASS[niveau]}`}>
      {NIVEAU_LABELS[niveau]}
    </span>
  );
}

const STATUT_CLASS: Record<Statut, string> = {
  en_instruction: "border-ink/45",
  en_attente_pieces: "border-attention text-attention",
  valide: "border-ok text-ok",
  rejete: "border-rouge text-rouge",
};

export function StatutBadge({ statut }: { statut: Statut }) {
  return (
    <span className={`inline-block whitespace-nowrap border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${STATUT_CLASS[statut]}`}>
      {STATUT_LABELS[statut]}
    </span>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-voile/55 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card w-full ${wide ? "max-w-4xl" : "max-w-2xl"} mt-8 border-t-[5px] border-t-rouge`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-display text-xl">{title}</h2>
          <button type="button" className="btn-sm" onClick={onClose} aria-label="Fermer">
            Fermer
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted italic py-6 text-center">{children}</p>;
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-center justify-between px-5 py-3 border-b border-line">
        <h2 className="label-caps">{title}</h2>
        {aside}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export const estClos = (statut: Statut) => statut === "valide" || statut === "rejete";

export function fmtMontant(m: number, devise: string): string {
  return m ? `${formatNombreFR(m)}\u00A0${devise}` : "—";
}
