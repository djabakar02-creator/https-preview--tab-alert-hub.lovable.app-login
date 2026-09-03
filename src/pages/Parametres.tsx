import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../App";
import { TYPE_LABELS, type TypeDossier } from "../lib/dossiers";
import { formatDateTimeFR } from "../lib/dates";
import {
  creerCompte,
  definirDelai,
  modifierCompte,
  ROLE_LABELS,
  supprimerCompte,
  useComptes,
  useDelais,
  useHistoriqueParametres,
  type Compte,
  type RoleCompte,
} from "../lib/parametres";
import { Empty, Modal, Section } from "../components/ui";

/**
 * Charte des attributions et restrictions.
 *
 * Établie avant l'écriture de cet onglet, pour que chaque contrôle ci-dessous
 * en soit l'application et non l'inverse. Appliquée aux deux bouts : côté
 * serveur (server/annuaire.mjs, server/parametres.mjs) quand un service est
 * présent, côté navigateur (src/lib/parametres.ts) sinon — jamais seulement
 * dans l'interface.
 */
const CHARTE: { titre: string; regle: string }[] = [
  { titre: "Séparation des pouvoirs", regle: "Un analyste instruit ; seules la hiérarchie et l'administration décident (valident ou rejettent). Un analyste ne peut jamais clore son propre dossier." },
  { titre: "Lecture seule sans exception", regle: "Le rôle Consultation n'écrit jamais rien — ni dossier, ni compte, ni paramètre." },
  { titre: "Comptes et paramètres réservés", regle: "Seul un administrateur crée un compte, change un rôle, réinitialise un mot de passe, ou modifie un délai réglementaire par défaut." },
  { titre: "Au moins un administrateur", regle: "Un administrateur ne peut ni se rétrograder ni être rétrogradé, ni être supprimé, s'il est le dernier restant : l'application ne doit jamais se retrouver sans administrateur." },
  { titre: "Pas d'auto-suppression", regle: "Un administrateur ne peut pas supprimer son propre compte, quel que soit le nombre d'administrateurs." },
  { titre: "Délais non rétroactifs", regle: "Un délai réglementaire par défaut modifié ici ne s'applique qu'aux dossiers créés ensuite. Chaque dossier déjà enregistré garde le sien, figé à sa création." },
  { titre: "Circuits fixes", regle: "La matrice des droits (qui crée, édite, décide, réattribue, importe) n'est pas modifiable depuis cet écran : la faire varier librement serait le principal risque d'incompatibilité. Toute évolution passe par le code, revue comme telle." },
  { titre: "Aucun dossier oublié", regle: "Supprimer un compte ne touche pas aux dossiers qu'il a traités : leur historique garde son nom, tel quel." },
  { titre: "Traçabilité complète", regle: "Toute création, modification ou suppression de compte, tout changement de délai, est journalisé — date, auteur, action — et consultable ci-dessous." },
];

const ROLES: RoleCompte[] = ["admin", "hierarchie", "analyste", "lecture"];
const TYPES = Object.keys(TYPE_LABELS) as TypeDossier[];

/* ------------------------------------------------------------------ */
/* Charte                                                                */
/* ------------------------------------------------------------------ */

function CharteSection() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <Section
      title="Charte des attributions et restrictions"
      aside={
        <button type="button" className="btn-sm" onClick={() => setOuvert((o) => !o)}>
          {ouvert ? "Réduire" : "Lire la charte"}
        </button>
      }
    >
      {ouvert ? (
        <ol className="space-y-3">
          {CHARTE.map((c, i) => (
            <li key={c.titre} className="text-sm">
              <p className="font-bold">
                {i + 1}. {c.titre}
              </p>
              <p className="text-muted mt-0.5">{c.regle}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">
          Neuf principes encadrent ce qui suit : séparation des pouvoirs, portée des rôles, non-rétroactivité des délais, traçabilité. Chaque
          contrôle de cette page en découle.
        </p>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Comptes                                                               */
/* ------------------------------------------------------------------ */

function CompteForm({
  initial,
  proprePseudo,
  onClose,
  signaler,
}: {
  initial: Compte | null;
  proprePseudo: string;
  onClose: () => void;
  signaler: (m: string) => void;
}) {
  const [username, setUsername] = useState(initial?.username ?? "");
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [role, setRole] = useState<RoleCompte>(initial?.role ?? "analyste");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (envoi) return;
    setEnvoi(true);
    setErreurs([]);
    try {
      if (initial) {
        await modifierCompte(proprePseudo, initial.username, {
          displayName,
          role,
          motDePasse: motDePasse || undefined,
        });
      } else {
        await creerCompte(proprePseudo, { username, displayName, role, motDePasse });
      }
      signaler(initial ? `Compte ${initial.username} modifié.` : `Compte ${username.trim().toLowerCase()} créé.`);
      onClose();
    } catch (err) {
      setErreurs([err instanceof Error ? err.message : "Écriture refusée."]);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Modal title={initial ? `Modifier ${initial.username}` : "Nouveau compte"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {!initial && (
          <label className="block">
            <span className="label-caps text-[10px] block mb-1">Identifiant</span>
            <input
              className="field font-mono"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex. mvondo"
              autoFocus
            />
          </label>
        )}
        <label className="block">
          <span className="label-caps text-[10px] block mb-1">Nom affiché</span>
          <input className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus={Boolean(initial)} />
        </label>
        <label className="block">
          <span className="label-caps text-[10px] block mb-1">Rôle</span>
          <select className="field" value={role} onChange={(e) => setRole(e.target.value as RoleCompte)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label-caps text-[10px] block mb-1">{initial ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"}</span>
          <input className="field" type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} placeholder="8 caractères au moins" />
        </label>

        {erreurs.length > 0 && (
          <ul className="text-sm text-rouge space-y-0.5">
            {erreurs.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn-fort" disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ComptesSection({ signaler }: { signaler: (m: string) => void }) {
  const user = useUser();
  const comptes = useComptes();
  const [forme, setForme] = useState<{ open: boolean; compte: Compte | null }>({ open: false, compte: null });
  const nbAdmins = comptes.filter((c) => c.role === "admin").length;

  async function retirer(c: Compte) {
    if (c.username === user.username) return signaler("Vous ne pouvez pas supprimer votre propre compte.");
    if (!window.confirm(`Supprimer le compte ${c.username} ? Cette action ne peut pas être annulée.`)) return;
    try {
      await supprimerCompte(user.username, c.username);
      signaler(`Compte ${c.username} supprimé.`);
    } catch (e) {
      signaler(e instanceof Error ? e.message : "Suppression refusée.");
    }
  }

  return (
    <Section
      title="Comptes et rôles"
      aside={
        <button type="button" className="btn-sm" onClick={() => setForme({ open: true, compte: null })}>
          Nouveau compte
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left label-caps text-[10px] border-b border-line bg-sand/60">
              <th className="px-3 py-2.5">Identifiant</th>
              <th className="px-3 py-2.5">Nom affiché</th>
              <th className="px-3 py-2.5">Rôle</th>
              <th className="px-3 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {comptes.map((c) => {
              const dernierAdmin = c.role === "admin" && nbAdmins <= 1;
              return (
                <tr key={c.username} className="border-b border-hair hover:bg-sand/40">
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {c.username}
                    {c.username === user.username && <span className="text-muted"> · vous</span>}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{c.displayName}</td>
                  <td className="px-3 py-2.5">
                    <span className="puce-inactive">{ROLE_LABELS[c.role]}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap space-x-1">
                    <button type="button" className="btn-sm" onClick={() => setForme({ open: true, compte: c })}>
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="btn-sm"
                      disabled={c.username === user.username || dernierAdmin}
                      title={
                        c.username === user.username
                          ? "Vous ne pouvez pas supprimer votre propre compte."
                          : dernierAdmin
                            ? "Dernier administrateur : la suppression est refusée."
                            : ""
                      }
                      onClick={() => retirer(c)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {forme.open && (
        <CompteForm
          initial={forme.compte}
          proprePseudo={user.username}
          onClose={() => setForme({ open: false, compte: null })}
          signaler={signaler}
        />
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Délais réglementaires                                                */
/* ------------------------------------------------------------------ */

function DelaiForm({
  type,
  jours,
  ouvres,
  onClose,
  signaler,
}: {
  type: TypeDossier;
  jours: number;
  /** Mode de décompte actuel, préservé tel quel : non modifiable depuis ce formulaire. */
  ouvres: boolean;
  onClose: () => void;
  signaler: (m: string) => void;
}) {
  const user = useUser();
  const [valeur, setValeur] = useState(String(jours));
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (envoi) return;
    const n = Number(valeur);
    if (!Number.isInteger(n) || n <= 0) return setErreur("Indiquez un nombre entier de jours, supérieur à zéro.");
    setEnvoi(true);
    setErreur(null);
    try {
      await definirDelai(user.username, type, { jours: n, ouvres });
      signaler(`Délai de « ${TYPE_LABELS[type]} » fixé à ${n} jour(s).`);
      onClose();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Modification refusée.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Modal title={`Délai réglementaire — ${TYPE_LABELS[type]}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block">
          <span className="label-caps text-[10px] block mb-1">Délai, en jours</span>
          <input className="field" type="number" min={1} value={valeur} onChange={(e) => setValeur(e.target.value)} autoFocus />
        </label>
        <p className="text-xs text-muted">
          S'applique aux dossiers créés à partir de maintenant. Les dossiers déjà au registre conservent le délai qui leur a été attribué à leur
          enregistrement.
        </p>
        {erreur && <p className="text-sm text-rouge">{erreur}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn-fort" disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  catalogue: "Catalogue du service",
  defaut: "Valeur de travail, à confirmer",
  parametre: "Fixé par le service",
};

function DelaisSection({ signaler }: { signaler: (m: string) => void }) {
  const delais = useDelais();
  const [edite, setEdite] = useState<TypeDossier | null>(null);

  return (
    <Section title="Délais réglementaires par défaut" aside={<span className="label-caps text-[9px] text-muted">S'appliquent aux nouveaux dossiers</span>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left label-caps text-[10px] border-b border-line bg-sand/60">
              <th className="px-3 py-2.5">Type d'opération</th>
              <th className="px-3 py-2.5 text-right">Délai</th>
              <th className="px-3 py-2.5">Décompte</th>
              <th className="px-3 py-2.5">Origine</th>
              <th className="px-3 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {TYPES.map((t) => {
              const d = delais[t];
              return (
                <tr key={t} className="border-b border-hair hover:bg-sand/40">
                  <td className="px-3 py-2.5">{TYPE_LABELS[t]}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums">{d.jours} j</td>
                  <td className="px-3 py-2.5 text-muted text-xs">{d.ouvres ? "Jours ouvrés" : "Jours calendaires"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs ${d.source === "defaut" ? "text-attention font-semibold" : "text-muted"}`}>{SOURCE_LABEL[d.source]}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button type="button" className="btn-sm" onClick={() => setEdite(t)}>
                      Modifier
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mt-3">
        Le mode de décompte (jours calendaires ou ouvrés) relève du catalogue du service et n'est pas modifiable depuis cet écran.
      </p>
      {edite && (
        <DelaiForm type={edite} jours={delais[edite].jours} ouvres={delais[edite].ouvres} onClose={() => setEdite(null)} signaler={signaler} />
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Circuits des dossiers (lecture seule)                                */
/* ------------------------------------------------------------------ */

const CIRCUIT: { role: RoleCompte; creer: string; editer: string; decider: string; reassigner: string; importer: string }[] = [
  { role: "admin", creer: "Oui", editer: "Tous les dossiers", decider: "Oui", reassigner: "Oui", importer: "Oui" },
  { role: "hierarchie", creer: "Non", editer: "Non", decider: "Oui", reassigner: "Oui", importer: "Non" },
  { role: "analyste", creer: "Oui, pour lui-même", editer: "Ses propres dossiers", decider: "Non", reassigner: "Non", importer: "Non" },
  { role: "lecture", creer: "Non", editer: "Non", decider: "Non", reassigner: "Non", importer: "Non" },
];

function CircuitsSection() {
  return (
    <Section title="Circuits des dossiers" aside={<span className="label-caps text-[9px] text-muted">Lecture seule</span>}>
      <p className="text-sm text-muted mb-4">
        Création → instruction → décision (validation ou rejet) → clôture. Cette matrice est fixée dans le code, pas dans les données : la
        charte ci-dessus en explique la raison. Le compte affecté à chaque dossier, lui, vient de l'annuaire ci-dessus et se met à jour dès
        qu'un compte est ajouté ou retiré.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left label-caps text-[10px] border-b border-line bg-sand/60">
              <th className="px-3 py-2.5">Rôle</th>
              <th className="px-3 py-2.5">Créer</th>
              <th className="px-3 py-2.5">Éditer</th>
              <th className="px-3 py-2.5">Décider</th>
              <th className="px-3 py-2.5">Réattribuer</th>
              <th className="px-3 py-2.5">Importer</th>
            </tr>
          </thead>
          <tbody>
            {CIRCUIT.map((r) => (
              <tr key={r.role} className="border-b border-hair">
                <td className="px-3 py-2.5 font-semibold">{ROLE_LABELS[r.role]}</td>
                <td className="px-3 py-2.5 text-muted">{r.creer}</td>
                <td className="px-3 py-2.5 text-muted">{r.editer}</td>
                <td className="px-3 py-2.5 text-muted">{r.decider}</td>
                <td className="px-3 py-2.5 text-muted">{r.reassigner}</td>
                <td className="px-3 py-2.5 text-muted">{r.importer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Historique                                                           */
/* ------------------------------------------------------------------ */

function HistoriqueSection() {
  const historique = useHistoriqueParametres();
  return (
    <Section title="Historique des modifications">
      {historique.length === 0 ? (
        <Empty>Aucune modification enregistrée.</Empty>
      ) : (
        <ol className="text-xs space-y-1.5 border-l-2 border-line pl-3 max-h-80 overflow-y-auto">
          {historique.map((h, i) => (
            <li key={i}>
              <span className="font-mono text-muted">{formatDateTimeFR(h.date)}</span> · <strong>{h.auteur}</strong> — {h.action}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */

export default function Parametres() {
  const user = useUser();
  const [message, setMessage] = useState<string | null>(null);
  if (user.role !== "admin") return <Navigate to="/" replace />;

  function signaler(m: string) {
    setMessage(m);
    setTimeout(() => setMessage(null), 5000);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps text-rouge mb-1">Paramètres</p>
        <h1 className="font-display text-3xl">Sécurité, comptes et délais</h1>
        <p className="text-sm mt-2 text-muted">Réservé à l'administrateur.</p>
      </div>
      {message && (
        <p role="status" className="text-sm font-semibold">
          {message}
        </p>
      )}
      <CharteSection />
      <ComptesSection signaler={signaler} />
      <DelaisSection signaler={signaler} />
      <CircuitsSection />
      <HistoriqueSection />
    </div>
  );
}
