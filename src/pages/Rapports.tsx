import { useMemo, useState } from "react";
import { DEMO_ACCOUNTS } from "../lib/auth";
import { formatClock } from "../lib/dates";
import { calculerDelai, NIVEAU_LABELS, type Niveau } from "../lib/delais";
import { STATUT_LABELS, TYPE_LABELS, toCSV, useDossiers, type Statut, type TypeDossier } from "../lib/dossiers";
import { Section } from "../components/ui";
import { telechargerFichier } from "../lib/telechargement";

function Barre({ label, value, total, rouge }: { label: string; value: number; total: number; rouge?: boolean }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-56 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-3 bg-sand border border-ink/20">
        <div className={`h-full ${rouge ? "bg-rouge" : "bg-ink"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right tabular-nums font-bold">
        {value} <span className="opacity-60 font-normal">({pct}%)</span>
      </span>
    </div>
  );
}

export default function Rapports() {
  const dossiers = useDossiers();
  const [genereLe, setGenereLe] = useState(() => new Date());
  const [message, setMessage] = useState<string | null>(null);

  /* Le rapport est figé à la date de génération ; « Actualiser » le recalcule. */
  const rapport = useMemo(() => {
    const calc = dossiers.map((d) => ({ d, c: calculerDelai(d.dateReception, d.delaiReglementaire) }));
    const count = <K extends string>(keys: K[], f: (x: (typeof calc)[number]) => K) =>
      keys.map((k) => ({ k, n: calc.filter((x) => f(x) === k).length }));
    const enCours = calc.filter((x) => x.d.statut === "en_instruction" || x.d.statut === "en_attente_pieces");
    const restants = enCours.map((x) => x.c.delaiRestant);
    return {
      total: calc.length,
      parType: count(Object.keys(TYPE_LABELS) as TypeDossier[], (x) => x.d.type),
      parStatut: count(Object.keys(STATUT_LABELS) as Statut[], (x) => x.d.statut),
      /* Le niveau de délai n'a de sens que pour les dossiers en cours. */
      parNiveau: (Object.keys(NIVEAU_LABELS) as Niveau[]).map((k) => ({ k, n: enCours.filter((x) => x.c.niveau === k).length })),
      enCours: enCours.length,
      parAnalyste: [...DEMO_ACCOUNTS.filter((a) => a.role !== "lecture").map((a) => a.username), null].map((u) => ({
        k: u ?? "Non attribué",
        n: enCours.filter((x) => x.d.analyste === u).length,
      })),
      delaiMoyen: restants.length ? Math.round(restants.reduce((a, b) => a + b, 0) / restants.length) : null,
      delaiMin: restants.length ? Math.min(...restants) : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossiers, genereLe]);

  async function telecharger() {
    const nom = `registre-drc-${new Date().toISOString().slice(0, 10)}.csv`;
    try {
      /* Le BOM permet à Excel d'ouvrir le fichier en UTF-8. */
      const canal = await telechargerFichier(nom, "﻿" + toCSV(dossiers));
      if (canal === "refus") setMessage("Téléchargement annulé.");
      else setMessage(`Registre exporté : ${nom}`);
    } catch {
      setMessage("Téléchargement impossible dans ce navigateur : utilisez « Copier CSV ».");
    }
    setTimeout(() => setMessage(null), 4000);
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(toCSV(dossiers));
      setMessage("Registre copié dans le presse‑papiers.");
    } catch {
      setMessage("Copie impossible dans ce navigateur : utilisez le téléchargement.");
    }
    setTimeout(() => setMessage(null), 4000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps text-rouge mb-1">Rapports</p>
          <h1 className="font-display text-3xl">Synthèse du registre</h1>
          <p className="text-sm mt-2 opacity-70">
            Généré le <span className="font-mono">{formatClock(genereLe)}</span> · {rapport.total} dossier(s)
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={() => setGenereLe(new Date())}>
            Actualiser
          </button>
          <button type="button" className="btn-ghost" onClick={copier}>
            Copier CSV
          </button>
          <button type="button" className="btn-ghost" onClick={telecharger}>
            Télécharger CSV
          </button>
        </div>
      </div>
      {message && <p role="status" className="text-sm font-semibold">{message}</p>}

      <div className="grid md:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="label-caps text-[10px] opacity-70">Délai restant moyen (en cours)</p>
          <p className="font-display text-4xl mt-2">{rapport.delaiMoyen === null ? "—" : `${rapport.delaiMoyen} j`}</p>
        </div>
        <div className="card p-4">
          <p className="label-caps text-[10px] opacity-70">Délai restant minimal</p>
          <p className={`font-display text-4xl mt-2 ${rapport.delaiMin !== null && rapport.delaiMin <= 3 ? "text-rouge" : ""}`}>
            {rapport.delaiMin === null ? "—" : `${rapport.delaiMin} j`}
          </p>
        </div>
        <div className="card p-4">
          <p className="label-caps text-[10px] opacity-70">Dossiers au registre</p>
          <p className="font-display text-4xl mt-2">{rapport.total}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title={`Par niveau de délai (${rapport.enCours} en cours)`}>
          <div className="space-y-2">
            {rapport.parNiveau.map((x) => (
              <Barre key={x.k} label={NIVEAU_LABELS[x.k]} value={x.n} total={rapport.enCours} rouge={x.k === "urgent" || x.k === "depasse"} />
            ))}
          </div>
        </Section>
        <Section title="Par statut">
          <div className="space-y-2">
            {rapport.parStatut.map((x) => (
              <Barre key={x.k} label={STATUT_LABELS[x.k]} value={x.n} total={rapport.total} />
            ))}
          </div>
        </Section>
        <Section title="Par type de demande">
          <div className="space-y-2">
            {rapport.parType.map((x) => (
              <Barre key={x.k} label={TYPE_LABELS[x.k]} value={x.n} total={rapport.total} />
            ))}
          </div>
        </Section>
        <Section title="Charge par analyste (dossiers en cours)">
          <div className="space-y-2">
            {rapport.parAnalyste.map((x) => (
              <Barre key={x.k} label={x.k} value={x.n} total={rapport.parAnalyste.reduce((a, b) => a + b.n, 0)} rouge={x.k === "Non attribué"} />
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
