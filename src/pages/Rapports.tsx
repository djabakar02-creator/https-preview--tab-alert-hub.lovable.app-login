import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { formatClock, formatNombreFR } from "../lib/dates";
import { TYPE_COURT, TYPE_LABELS, toCSV, useDossiers, type TypeDossier } from "../lib/dossiers";
import { ecrireTypes, lireTypes } from "../lib/filtres";
import { construireRapport, type Rapport } from "../lib/rapport";
import { Section } from "../components/ui";
import { telechargerFichier } from "../lib/telechargement";

/* Couleurs de statut, réservées aux niveaux de délai : elles ne servent jamais
   de teintes de série. Chaque barre porte aussi son intitulé, donc l'information
   ne repose jamais sur la seule couleur. */
const TEINTE_NIVEAU: Record<string, string> = {
  conforme: "bg-ok",
  a_suivre: "bg-attention",
  urgent: "bg-rouge",
  depasse: "bg-ink",
};

/** Barre de magnitude, série unique : une seule teinte, valeur affichée à droite. */
function Barre({
  label,
  valeur,
  total,
  teinte = "bg-ink",
  suffixe,
}: {
  label: string;
  valeur: number;
  total: number;
  teinte?: string;
  suffixe?: string;
}) {
  const pct = total ? Math.round((valeur / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm" title={`${label} : ${valeur} (${pct} %)`}>
      <span className="w-52 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2.5 bg-sand border border-hair min-w-[60px]">
        <div className={`h-full ${teinte}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 text-right tabular-nums font-bold">
        {valeur}
        {suffixe ?? ""} <span className="text-muted font-normal">({pct} %)</span>
      </span>
    </div>
  );
}

/** Flux mensuel : série unique dans le temps, seul le maximum est étiqueté. */
function Flux({ lignes }: { lignes: Rapport["parMois"] }) {
  const max = Math.max(1, ...lignes.map((m) => m.nombre));
  return (
    <div>
      <div className="flex items-end gap-[2px] h-[104px]" role="img" aria-label="Réceptions par mois sur douze mois">
        {lignes.map((m) => (
          <div key={m.mois} className="flex-1 flex flex-col justify-end items-center gap-1" title={`${m.libelle} : ${m.nombre} dossier(s)`}>
            {m.nombre === max && m.nombre > 0 && <span className="text-[10px] font-bold tabular-nums">{m.nombre}</span>}
            <div
              className={`w-full ${m.nombre ? "bg-ink" : "bg-sand"}`}
              style={{ height: `${Math.max(m.nombre ? 3 : 1, (m.nombre / max) * 80)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] border-t border-ink/35 pt-1.5 mt-0.5">
        {lignes.map((m, i) => (
          <span key={m.mois} className="flex-1 text-[9px] text-center text-muted truncate">
            {i % 2 === 0 ? m.libelle : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function Tuile({ label, valeur, alerte }: { label: string; valeur: string; alerte?: boolean }) {
  return (
    <div className="card p-4">
      <p className="label-caps text-[10px] text-muted">{label}</p>
      <p className={`font-display text-4xl mt-2 tabular-nums ${alerte ? "text-rouge" : ""}`}>{valeur}</p>
    </div>
  );
}

export default function Rapports() {
  const dossiers = useDossiers();
  const [params, setParams] = useSearchParams();
  const [genereLe, setGenereLe] = useState(() => new Date());
  const [message, setMessage] = useState<string | null>(null);
  const [enCoursExport, setEnCoursExport] = useState<string | null>(null);

  const types = lireTypes(params.get("types"));
  const setTypes = (t: TypeDossier[]) => {
    const p = new URLSearchParams(params);
    if (t.length) p.set("types", ecrireTypes(t));
    else p.delete("types");
    setParams(p, { replace: true });
  };

  const retenus = useMemo(
    () => (types.length ? dossiers.filter((d) => types.includes(d.type)) : dossiers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dossiers, params.get("types")],
  );

  const perimetre = types.length ? types.map((t) => TYPE_LABELS[t]).join(", ") : "Tous types d'opération";

  /* Le rapport est figé à la date de génération ; « Actualiser » le recalcule. */
  const rapport = useMemo(
    () => construireRapport(retenus, perimetre),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [retenus, perimetre, genereLe],
  );

  function annoncer(texte: string) {
    setMessage(texte);
    setTimeout(() => setMessage(null), 5000);
  }

  async function exporter(format: "pdf" | "xlsx" | "csv") {
    if (enCoursExport) return;
    setEnCoursExport(format);
    try {
      if (format === "csv") {
        const nom = `registre-drc-${new Date().toISOString().slice(0, 10)}.csv`;
        const canal = await telechargerFichier(nom, "﻿" + toCSV(retenus));
        annoncer(canal === "refus" ? "Export annulé." : `Registre exporté : ${nom}`);
      } else {
        const doc = await import("../lib/export-documents");
        if (format === "pdf") await doc.exporterPDF(rapport, retenus);
        else await doc.exporterXLSX(rapport, retenus);
        annoncer(`Synthèse ${format.toUpperCase()} exportée (${retenus.length} dossier(s)).`);
      }
    } catch (e) {
      annoncer(`Export impossible : ${e instanceof Error ? e.message : "erreur inconnue"}.`);
    } finally {
      setEnCoursExport(null);
    }
  }

  const libelleExport = (f: string, defaut: string) => (enCoursExport === f ? "Préparation…" : defaut);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps text-rouge mb-1">Rapports</p>
          <h1 className="font-display text-3xl">Synthèse du registre</h1>
          <p className="text-sm mt-2 text-muted">
            {perimetre} · {rapport.total} dossier(s) · généré le <span className="font-mono">{formatClock(genereLe)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => setGenereLe(new Date())}>
            Actualiser
          </button>
          <button type="button" className="btn-ghost" disabled={Boolean(enCoursExport)} onClick={() => exporter("csv")}>
            {libelleExport("csv", "CSV")}
          </button>
          <button type="button" className="btn-ghost" disabled={Boolean(enCoursExport)} onClick={() => exporter("xlsx")}>
            {libelleExport("xlsx", "Classeur XLSX")}
          </button>
          <button type="button" className="btn-ghost bg-fort text-sur-fort" disabled={Boolean(enCoursExport)} onClick={() => exporter("pdf")}>
            {libelleExport("pdf", "Synthèse PDF")}
          </button>
        </div>
      </div>
      {message && (
        <p role="status" className="text-sm font-semibold">
          {message}
        </p>
      )}

      {/* Périmètre : mêmes types que dans le registre. */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="label-caps text-[10px] text-muted">Type d'opération</p>
          <button type="button" className="btn-sm" disabled={types.length === 0} onClick={() => setTypes([])}>
            Tous les types
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(TYPE_COURT) as TypeDossier[]).map((t) => {
            const actif = types.includes(t);
            const n = dossiers.filter((d) => d.type === t).length;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={actif}
                onClick={() => setTypes(actif ? types.filter((x) => x !== t) : [...types, t])}
                title={TYPE_LABELS[t]}
                className={actif ? "puce-active" : "puce-inactive"}
              >
                {TYPE_COURT[t]}
                <span className={`ml-1.5 tabular-nums ${actif ? "opacity-70" : "opacity-50"}`}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tuile label="Dossiers" valeur={String(rapport.total)} />
        <Tuile label="En cours" valeur={String(rapport.enCours)} />
        <Tuile label="Délai moyen" valeur={rapport.delaiMoyen === null ? "—" : `${rapport.delaiMoyen} j`} />
        <Tuile
          label="Dans les délais"
          valeur={rapport.tauxRespect === null ? "—" : `${rapport.tauxRespect} %`}
          alerte={rapport.tauxRespect !== null && rapport.tauxRespect < 80}
        />
        <Tuile label="Complétude" valeur={rapport.completude === null ? "—" : `${rapport.completude} %`} />
      </div>

      {/* Points d'attention : ce qui appelle une action. */}
      <div className="card border-l-[5px] border-l-rouge p-4 flex flex-wrap gap-x-10 gap-y-2 text-sm">
        <span>
          Dossiers non attribués : <strong className={rapport.nonAttribues ? "text-rouge" : ""}>{rapport.nonAttribues}</strong>
        </span>
        <span>
          Pièces manquantes : <strong className={rapport.piecesManquantes ? "text-rouge" : ""}>{rapport.piecesManquantes}</strong>
        </span>
        <span>
          Dossiers complets : <strong>{rapport.dossiersComplets}</strong> / {rapport.total}
        </span>
        <span>
          Plus ancien dossier en cours : <strong>{rapport.ancienneteMax === null ? "—" : `J+${rapport.ancienneteMax}`}</strong>
        </span>
        <span>
          Délai médian : <strong>{rapport.delaiMedian === null ? "—" : `${rapport.delaiMedian} j`}</strong>
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title={`Par niveau de délai (${rapport.enCours} en cours)`}>
          <div className="space-y-2">
            {rapport.parNiveau.map((n) => (
              <Barre key={n.cle} label={n.libelle} valeur={n.nombre} total={rapport.enCours} teinte={TEINTE_NIVEAU[n.cle]} />
            ))}
          </div>
        </Section>

        <Section title="Par statut">
          <div className="space-y-2">
            {rapport.parStatut.map((s) => (
              <Barre key={s.cle} label={s.libelle} valeur={s.nombre} total={rapport.total} />
            ))}
          </div>
        </Section>

        <Section title="Réceptions par mois" aside={<span className="label-caps text-[9px] text-muted">12 derniers mois</span>}>
          <Flux lignes={rapport.parMois} />
        </Section>

        <Section title="Montants par devise">
          {rapport.parDevise.length === 0 ? (
            <p className="text-sm text-muted italic py-4">Aucun montant renseigné sur ce périmètre.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left label-caps text-[10px] border-b border-line">
                    <th className="py-2 pr-4">Devise</th>
                    <th className="py-2 pr-4 text-right">Dossiers</th>
                    <th className="py-2 text-right">Montant cumulé</th>
                  </tr>
                </thead>
                <tbody>
                  {rapport.parDevise.map((d) => (
                    <tr key={d.devise} className="border-b border-hair">
                      <td className="py-2 pr-4 font-semibold">{d.devise}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{d.nombre}</td>
                      <td className="py-2 text-right tabular-nums font-bold">{formatNombreFR(d.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      <Section title="Détail par type d'opération">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left label-caps text-[10px] border-b border-line bg-sand/60">
                <th className="px-3 py-2.5">Type d'opération</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5 text-right">En cours</th>
                <th className="px-3 py-2.5 text-right">Clos</th>
                <th className="px-3 py-2.5 text-right">Délai moyen</th>
                <th className="px-3 py-2.5 text-right">Urgents</th>
                <th className="px-3 py-2.5 text-right">Dépassés</th>
                <th className="px-3 py-2.5 text-right">Pièces</th>
              </tr>
            </thead>
            <tbody>
              {rapport.parType.map((t) => (
                <tr key={t.type} className="border-b border-hair hover:bg-sand/40">
                  <td className="px-3 py-2.5 font-semibold">{t.libelle}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.total}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.enCours}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{t.clos}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.delaiMoyen === null ? "—" : `${t.delaiMoyen} j`}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${t.urgents ? "text-rouge font-bold" : "text-muted"}`}>{t.urgents}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${t.depasses ? "text-rouge font-bold" : "text-muted"}`}>{t.depasses}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.completude} %</td>
                </tr>
              ))}
              {rapport.parType.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-sm text-muted italic">
                    Aucun dossier sur ce périmètre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Charge par analyste (dossiers en cours)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left label-caps text-[10px] border-b border-line bg-sand/60">
                <th className="px-3 py-2.5">Analyste</th>
                <th className="px-3 py-2.5 text-right">En cours</th>
                <th className="px-3 py-2.5 text-right">Urgents</th>
                <th className="px-3 py-2.5 text-right">Dépassés</th>
                <th className="px-3 py-2.5 text-right">Délai le plus court</th>
              </tr>
            </thead>
            <tbody>
              {rapport.parAnalyste.map((a) => (
                <tr key={a.analyste} className="border-b border-hair hover:bg-sand/40">
                  <td className={`px-3 py-2.5 font-semibold ${a.analyste === "Non attribué" ? "text-rouge" : ""}`}>{a.analyste}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{a.enCours}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${a.urgents ? "text-rouge font-bold" : "text-muted"}`}>{a.urgents}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${a.depasses ? "text-rouge font-bold" : "text-muted"}`}>{a.depasses}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{a.delaiMin === null ? "—" : `${a.delaiMin} j`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
