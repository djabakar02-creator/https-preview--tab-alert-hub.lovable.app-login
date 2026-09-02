import { useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useUser } from "../App";
import { DEMO_ACCOUNTS } from "../lib/auth";
import { formatDateFR, formatDateTimeFR, toISODate } from "../lib/dates";
import { calculerDelai, NIVEAU_LABELS, type Niveau } from "../lib/delais";
import {
  DELAI_PAR_TYPE,
  fromCSV,
  newId,
  nextReference,
  piecesRequises,
  removeDossier,
  replaceAll,
  resetToSeed,
  STATUT_LABELS,
  TYPE_LABELS,
  upsertDossier,
  useDossiers,
  withEvent,
  type Dossier,
  type Statut,
  type TypeDossier,
} from "../lib/dossiers";
import { can } from "../lib/permissions";
import { correspond } from "../lib/filtres";
import { Empty, estClos, fmtMontant, Modal, NiveauBadge, StatutBadge } from "../components/ui";

const ANALYSTES = DEMO_ACCOUNTS.filter((a) => a.role === "analyste" || a.role === "hierarchie" || a.role === "admin");

/* ------------------------------------------------------------------ */
/* Formulaire création / édition                                        */
/* ------------------------------------------------------------------ */

function DossierForm({ initial, onClose }: { initial: Dossier | null; onClose: () => void }) {
  const user = useUser();
  const today = toISODate(new Date());
  const [f, setF] = useState<Dossier>(
    initial ?? {
      id: newId(),
      reference: nextReference(),
      demandeur: "",
      type: "transfert",
      montant: 0,
      devise: "XAF",
      dateReception: today,
      delaiReglementaire: DELAI_PAR_TYPE.transfert,
      analyste: user.role === "analyste" ? user.username : null,
      statut: "en_instruction",
      pieces: piecesRequises("transfert"),
      observations: "",
      historique: [],
    },
  );
  const [erreurs, setErreurs] = useState<string[]>([]);
  const calc = calculerDelai(f.dateReception, f.delaiReglementaire);
  const set = <K extends keyof Dossier>(k: K, v: Dossier[K]) => setF((x) => ({ ...x, [k]: v }));

  function changerType(type: TypeDossier) {
    setF((x) => ({
      ...x,
      type,
      delaiReglementaire: DELAI_PAR_TYPE[type],
      pieces: initial && initial.type === type ? initial.pieces : piecesRequises(type),
    }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    if (!f.reference.trim()) errs.push("La référence est obligatoire.");
    if (!f.demandeur.trim()) errs.push("Le demandeur est obligatoire.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dateReception)) errs.push("La date de réception est invalide.");
    else if (f.dateReception > today) errs.push("La date de réception ne peut pas être postérieure à aujourd'hui.");
    if (!(f.delaiReglementaire > 0)) errs.push("Le délai réglementaire doit être un nombre de jours positif.");
    if (f.montant < 0) errs.push("Le montant ne peut pas être négatif.");
    if (errs.length) return setErreurs(errs);

    /* Un dossier créé par un analyste lui est automatiquement attribué. */
    const analyste = user.role === "analyste" ? user.username : f.analyste;
    const d = withEvent(
      { ...f, analyste, reference: f.reference.trim(), demandeur: f.demandeur.trim() },
      user.username,
      initial ? "Modification du dossier" : "Enregistrement du dossier au registre",
    );
    upsertDossier(d);
    onClose();
  }

  return (
    <Modal title={initial ? `Modifier ${initial.reference}` : "Nouveau dossier"} onClose={onClose} wide>
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-4" noValidate>
        <label className="block">
          <span className="label-caps text-[10px] block mb-1">Référence</span>
          <input className="field font-mono" value={f.reference} onChange={(e) => set("reference", e.target.value)} />
        </label>
        <label className="block">
          <span className="label-caps text-[10px] block mb-1">Demandeur</span>
          <input className="field" value={f.demandeur} onChange={(e) => set("demandeur", e.target.value)} autoFocus />
        </label>
        <label className="block">
          <span className="label-caps text-[10px] block mb-1">Type de demande</span>
          <select className="field" value={f.type} onChange={(e) => changerType(e.target.value as TypeDossier)}>
            {(Object.keys(TYPE_LABELS) as TypeDossier[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-[1fr_90px] gap-2">
          <label className="block">
            <span className="label-caps text-[10px] block mb-1">Montant</span>
            <input className="field" type="number" min={0} value={f.montant} onChange={(e) => set("montant", Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="label-caps text-[10px] block mb-1">Devise</span>
            <select className="field" value={f.devise} onChange={(e) => set("devise", e.target.value)}>
              {["XAF", "EUR", "USD", "GBP", "CNY"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="label-caps text-[10px] block mb-1">Date de réception par la Banque Centrale</span>
          <input className="field" type="date" max={today} value={f.dateReception} onChange={(e) => set("dateReception", e.target.value)} />
        </label>
        <label className="block">
          <span className="label-caps text-[10px] block mb-1">Délai réglementaire (jours)</span>
          <input className="field" type="number" min={1} value={f.delaiReglementaire} onChange={(e) => set("delaiReglementaire", Number(e.target.value))} />
        </label>
        <div className="md:col-span-2 card bg-sand p-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
          <span>
            Délai écoulé : <strong>J+{calc.joursEcoules}</strong>
          </span>
          <span>
            Échéance : <strong>{formatDateFR(calc.echeance)}</strong>
          </span>
          <span>
            Délai restant : <strong className={calc.delaiRestant <= 3 ? "text-rouge" : ""}>{calc.delaiRestant} j</strong>
          </span>
          <NiveauBadge niveau={calc.niveau} />
          <span className="opacity-60 text-xs w-full">Calculé automatiquement : date du jour − date de réception. Non modifiable.</span>
        </div>
        {user.role !== "analyste" && (
          <label className="block">
            <span className="label-caps text-[10px] block mb-1">Analyste traitant</span>
            <select className="field" value={f.analyste ?? ""} onChange={(e) => set("analyste", e.target.value || null)}>
              <option value="">— Non attribué —</option>
              {ANALYSTES.map((a) => (
                <option key={a.username} value={a.username}>
                  {a.username} · {a.displayName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="label-caps text-[10px] block mb-1">Statut</span>
          <select
            className="field"
            value={f.statut}
            onChange={(e) => set("statut", e.target.value as Statut)}
            disabled={!can.decide(user, f) && (f.statut === "valide" || f.statut === "rejete")}
          >
            {(Object.keys(STATUT_LABELS) as Statut[])
              .filter((s) => can.decide(user, f) || (s !== "valide" && s !== "rejete") || s === f.statut)
              .map((s) => (
                <option key={s} value={s}>
                  {STATUT_LABELS[s]}
                </option>
              ))}
          </select>
        </label>
        <fieldset className="md:col-span-2">
          <legend className="label-caps text-[10px] mb-2">Pièces du dossier</legend>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {f.pieces.map((p, i) => (
              <label key={p.label} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={p.fourni}
                  onChange={(e) =>
                    set(
                      "pieces",
                      f.pieces.map((q, j) => (j === i ? { ...q, fourni: e.target.checked } : q)),
                    )
                  }
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block md:col-span-2">
          <span className="label-caps text-[10px] block mb-1">Observations</span>
          <textarea className="field" rows={3} value={f.observations} onChange={(e) => set("observations", e.target.value)} />
        </label>
        {erreurs.length > 0 && (
          <ul role="alert" className="md:col-span-2 text-rouge text-sm font-semibold list-disc pl-5">
            {erreurs.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="md:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn-ghost bg-ink text-white">
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Fiche dossier + actions                                              */
/* ------------------------------------------------------------------ */

function Fiche({ d, onClose, onEdit }: { d: Dossier; onClose: () => void; onEdit: () => void }) {
  const user = useUser();
  const navigate = useNavigate();
  const c = calculerDelai(d.dateReception, d.delaiReglementaire);
  const [reassign, setReassign] = useState<string>(d.analyste ?? "");
  const [confirmSuppr, setConfirmSuppr] = useState(false);
  const clos = estClos(d.statut);

  const decider = (statut: Statut, action: string) => upsertDossier(withEvent({ ...d, statut }, user.username, action));

  return (
    <Modal title={d.reference} onClose={onClose} wide>
      <div className="grid md:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-5">
          <div>
            <p className="font-display text-2xl">{d.demandeur}</p>
            <p className="text-sm opacity-70">{TYPE_LABELS[d.type]} · {fmtMontant(d.montant, d.devise)}</p>
            <div className="flex gap-2 mt-2">
              <StatutBadge statut={d.statut} />
              <NiveauBadge niveau={c.niveau} clos={clos} />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="opacity-70">Réception BEAC</dt>
            <dd className="font-semibold">{formatDateFR(d.dateReception)}</dd>
            <dt className="opacity-70">Délai réglementaire</dt>
            <dd className="font-semibold">{d.delaiReglementaire} jours</dd>
            <dt className="opacity-70">Jours écoulés</dt>
            <dd className="font-semibold tabular-nums">J+{c.joursEcoules}</dd>
            <dt className="opacity-70">Échéance</dt>
            <dd className="font-semibold">{formatDateFR(c.echeance)}</dd>
            <dt className="opacity-70">Délai restant</dt>
            <dd className={`font-bold tabular-nums ${!clos && c.delaiRestant <= 3 ? "text-rouge" : ""}`}>
              {clos ? "— (dossier clos)" : `${c.delaiRestant} jour(s)`}
            </dd>
            <dt className="opacity-70">Analyste traitant</dt>
            <dd className="font-semibold">{d.analyste ?? <span className="text-rouge">Non attribué</span>}</dd>
          </dl>
          <div>
            <p className="label-caps text-[10px] mb-2">Pièces</p>
            <ul className="text-sm space-y-1">
              {d.pieces.map((p) => (
                <li key={p.label} className="flex items-center gap-2">
                  <span className={`inline-block w-2.5 h-2.5 border ${p.fourni ? "bg-emerald-600 border-emerald-700" : "bg-white border-rouge"}`} />
                  {p.label}
                  {!p.fourni && <span className="text-rouge text-[10px] font-bold uppercase tracking-widest ml-1">manquante</span>}
                </li>
              ))}
            </ul>
          </div>
          {d.observations && (
            <div>
              <p className="label-caps text-[10px] mb-1">Observations</p>
              <p className="text-sm whitespace-pre-wrap">{d.observations}</p>
            </div>
          )}
          <div>
            <p className="label-caps text-[10px] mb-2">Historique</p>
            <ol className="text-xs space-y-1 border-l-2 border-line pl-3">
              {[...d.historique].reverse().map((h, i) => (
                <li key={i}>
                  <span className="font-mono opacity-60">{formatDateTimeFR(h.date)}</span> · <strong>{h.auteur}</strong> — {h.action}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="space-y-2">
          <p className="label-caps text-[10px] mb-1">Actions</p>
          <button type="button" className="btn-ghost w-full" onClick={() => navigate(`/ora?dossier=${d.id}`)}>
            Vérifier avec Ora
          </button>
          <button type="button" className="btn-ghost w-full" disabled={!can.edit(user, d)} onClick={onEdit} title={can.edit(user, d) ? "" : "Réservé à l'analyste traitant ou à l'administrateur"}>
            Modifier
          </button>
          {can.decide(user, d) && !clos && (
            <>
              <button type="button" className="btn-ghost w-full bg-ink text-white" onClick={() => decider("valide", "Validation du dossier")}>
                Valider
              </button>
              <button type="button" className="btn-ghost w-full text-rouge border-rouge" onClick={() => decider("rejete", "Rejet du dossier")}>
                Rejeter
              </button>
            </>
          )}
          {can.decide(user, d) && clos && (
            <button type="button" className="btn-ghost w-full" onClick={() => decider("en_instruction", "Réouverture du dossier")}>
              Rouvrir
            </button>
          )}
          {can.reassign(user, d) && (
            <div className="pt-2">
              <p className="label-caps text-[10px] mb-1">Réassigner</p>
              <div className="flex gap-1">
                <select className="field" value={reassign} onChange={(e) => setReassign(e.target.value)}>
                  <option value="">— Non attribué —</option>
                  {ANALYSTES.map((a) => (
                    <option key={a.username} value={a.username}>
                      {a.username}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-sm shrink-0"
                  disabled={(reassign || null) === d.analyste}
                  onClick={() => upsertDossier(withEvent({ ...d, analyste: reassign || null }, user.username, reassign ? `Réattribution à ${reassign}` : "Retrait de l'attribution"))}
                >
                  OK
                </button>
              </div>
            </div>
          )}
          {can.delete(user, d) && (
            <div className="pt-3 border-t border-line mt-3">
              {confirmSuppr ? (
                <div className="space-y-2">
                  <p className="text-xs text-rouge font-semibold">Supprimer définitivement ce dossier ?</p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn-sm bg-rouge text-white border-rouge"
                      onClick={() => {
                        removeDossier(d.id);
                        onClose();
                      }}
                    >
                      Confirmer
                    </button>
                    <button type="button" className="btn-sm" onClick={() => setConfirmSuppr(false)}>
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn-ghost w-full text-rouge border-rouge" onClick={() => setConfirmSuppr(true)}>
                  Supprimer
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Import tableur                                                        */
/* ------------------------------------------------------------------ */

function ImportModal({ onClose }: { onClose: () => void }) {
  const [texte, setTexte] = useState("");
  const [resultat, setResultat] = useState<ReturnType<typeof fromCSV> | null>(null);
  const [mode, setMode] = useState<"ajouter" | "remplacer">("ajouter");
  const fileRef = useRef<HTMLInputElement>(null);
  const existants = useDossiers();

  async function lireFichier(file: File) {
    setTexte(await file.text());
    setResultat(null);
  }

  function appliquer() {
    if (!resultat) return;
    const next = mode === "remplacer" ? resultat.dossiers : [...resultat.dossiers, ...existants];
    replaceAll(next);
    onClose();
  }

  return (
    <Modal title="Import tableur (CSV)" onClose={onClose} wide>
      <div className="space-y-4 text-sm">
        <p className="opacity-70">
          Colonnes attendues (séparateur ; ou ,) : <code className="font-mono text-xs">reference;demandeur;type;montant;devise;dateReception;delaiReglementaire;analyste;statut</code>.
          Exportez d'abord depuis l'onglet Rapports pour obtenir un modèle.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && lireFichier(e.target.files[0])} />
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
            Choisir un fichier
          </button>
          <label className="flex items-center gap-1">
            <input type="radio" checked={mode === "ajouter"} onChange={() => setMode("ajouter")} /> Ajouter au registre
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={mode === "remplacer"} onChange={() => setMode("remplacer")} /> Remplacer le registre
          </label>
        </div>
        <textarea className="field font-mono text-xs" rows={8} value={texte} onChange={(e) => { setTexte(e.target.value); setResultat(null); }} placeholder="…ou collez le contenu CSV ici" />
        {resultat && (
          <div className="card bg-sand p-3">
            <p className="font-semibold">{resultat.dossiers.length} dossier(s) prêt(s) à importer.</p>
            {resultat.erreurs.length > 0 && (
              <ul className="list-disc pl-5 text-rouge mt-1">
                {resultat.erreurs.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" disabled={!texte.trim()} onClick={() => setResultat(fromCSV(texte))}>
            Analyser
          </button>
          <button type="button" className="btn-ghost bg-ink text-white" disabled={!resultat || resultat.dossiers.length === 0} onClick={appliquer}>
            Importer
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page Registre                                                         */
/* ------------------------------------------------------------------ */

export default function Registre() {
  const user = useUser();
  const dossiers = useDossiers();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [formulaire, setFormulaire] = useState<{ open: boolean; dossier: Dossier | null }>({ open: false, dossier: null });
  const [importOpen, setImportOpen] = useState(false);

  const q = params.get("q") ?? "";
  const statut = params.get("statut") ?? "";
  const niveau = params.get("niveau") ?? "";
  /* « __tous » est une valeur explicite, et non la chaîne vide : sans cela,
     un analyste qui choisit « Tous les analystes » effacerait le paramètre et
     retomberait aussitôt sur le défaut « Mes dossiers ». */
  const analyste = params.get("analyste") ?? (user.role === "analyste" ? "__mine" : "__tous");
  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const lignes = useMemo(() => {
    return dossiers
      .map((d) => ({ d, c: calculerDelai(d.dateReception, d.delaiReglementaire) }))
      .filter(({ d, c }) => correspond(d, c, { q, statut, niveau, analyste }, user.username))
      .sort((a, b) => a.c.delaiRestant - b.c.delaiRestant);
  }, [dossiers, q, statut, niveau, analyste, user.username]);

  const selection = id ? dossiers.find((d) => d.id === id) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps text-rouge mb-1">Registre</p>
          <h1 className="font-display text-3xl">Dossiers d'autorisation</h1>
          <p className="text-sm mt-2 opacity-70">
            {lignes.length} / {dossiers.length} dossier(s) · délais recalculés en continu depuis la date de réception
          </p>
        </div>
        <div className="flex gap-2">
          {can.import(user) && (
            <>
              <button type="button" className="btn-ghost" onClick={() => setImportOpen(true)}>
                Importer CSV
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => window.confirm("Réinitialiser le registre avec les données de démonstration ?") && resetToSeed()}
              >
                Réinitialiser
              </button>
            </>
          )}
          {can.create(user) && (
            <button type="button" className="btn-ghost bg-ink text-white" onClick={() => setFormulaire({ open: true, dossier: null })}>
              Nouveau dossier
            </button>
          )}
        </div>
      </div>

      <div className="card p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input className="field" placeholder="Rechercher (référence, demandeur, type)…" value={q} onChange={(e) => setParam("q", e.target.value)} aria-label="Recherche" />
        <select className="field" value={statut} onChange={(e) => setParam("statut", e.target.value)} aria-label="Statut">
          <option value="">Tous les statuts</option>
          <option value="en_cours">En cours (instruction + attente)</option>
          {(Object.keys(STATUT_LABELS) as Statut[]).map((s) => (
            <option key={s} value={s}>
              {STATUT_LABELS[s]}
            </option>
          ))}
        </select>
        <select className="field" value={niveau} onChange={(e) => setParam("niveau", e.target.value)} aria-label="Niveau">
          <option value="">Tous les niveaux</option>
          {(Object.keys(NIVEAU_LABELS) as Niveau[]).map((n) => (
            <option key={n} value={n}>
              {NIVEAU_LABELS[n]}
            </option>
          ))}
        </select>
        <select className="field" value={analyste} onChange={(e) => setParam("analyste", e.target.value)} aria-label="Analyste">
          <option value="__tous">Tous les analystes</option>
          <option value="__mine">Mes dossiers</option>
          <option value="__none">Non attribués</option>
          {ANALYSTES.map((a) => (
            <option key={a.username} value={a.username}>
              {a.username}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        {lignes.length === 0 ? (
          <Empty>Aucun dossier ne correspond aux filtres.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left label-caps text-[10px] border-b border-line bg-sand/60">
                <th className="px-4 py-2.5">Référence</th>
                <th className="px-4 py-2.5">Demandeur</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Réception</th>
                <th className="px-4 py-2.5">Échéance</th>
                <th className="px-4 py-2.5">Écoulé</th>
                <th className="px-4 py-2.5">Restant</th>
                <th className="px-4 py-2.5">Niveau</th>
                <th className="px-4 py-2.5">Analyste</th>
                <th className="px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(({ d, c }) => {
                const clos = estClos(d.statut);
                return (
                  <tr key={d.id} className="border-b border-ink/10 hover:bg-sand/50 cursor-pointer" onClick={() => navigate(`/registre/${d.id}`)}>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{d.reference}</td>
                    <td className="px-3 py-2 font-semibold">{d.demandeur}</td>
                    <td className="px-3 py-2 text-xs">{TYPE_LABELS[d.type]}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateFR(d.dateReception)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateFR(c.echeance)}</td>
                    <td className="px-3 py-2 tabular-nums">J+{c.joursEcoules}</td>
                    <td className={`px-3 py-2 tabular-nums font-bold ${!clos && c.delaiRestant <= 3 ? "text-rouge" : ""}`}>
                      {clos ? "—" : `${c.delaiRestant} j`}
                    </td>
                    <td className="px-3 py-2">
                      <NiveauBadge niveau={c.niveau} clos={clos} />
                    </td>
                    <td className="px-3 py-2">{d.analyste ?? <span className="text-rouge text-xs">non attribué</span>}</td>
                    <td className="px-3 py-2">
                      <StatutBadge statut={d.statut} />
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="btn-sm" onClick={() => navigate(`/registre/${d.id}`)}>
                        Voir
                      </button>
                      <button
                        type="button"
                        className="btn-sm"
                        disabled={!can.edit(user, d)}
                        title={can.edit(user, d) ? "" : "Réservé à l'analyste traitant ou à l'administrateur"}
                        onClick={() => setFormulaire({ open: true, dossier: d })}
                      >
                        Modifier
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selection && !formulaire.open && (
        <Fiche d={selection} onClose={() => navigate("/registre")} onEdit={() => setFormulaire({ open: true, dossier: selection })} />
      )}
      {id && !selection && (
        <Modal title="Dossier introuvable" onClose={() => navigate("/registre")}>
          <p className="text-sm">Ce dossier n'existe pas ou a été supprimé.</p>
        </Modal>
      )}
      {formulaire.open && <DossierForm initial={formulaire.dossier} onClose={() => setFormulaire({ open: false, dossier: null })} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}
