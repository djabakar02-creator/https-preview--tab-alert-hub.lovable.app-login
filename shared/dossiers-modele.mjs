/**
 * Modèle métier des dossiers, partagé par le navigateur et le service.
 * En JavaScript simple, pour être importé sans étape de compilation.
 */

export const TYPE_LABELS = {
  transfert: "Transfert de fonds",
  investissement: "Investissement direct étranger",
  emprunt: "Emprunt extérieur",
  compte_devises: "Ouverture de compte en devises",
  rapatriement: "Rapatriement de recettes d'exportation",
  autre: "Autre demande",
};

export const STATUT_LABELS = {
  en_instruction: "En instruction",
  en_attente_pieces: "En attente de pièces",
  valide: "Validé",
  rejete: "Rejeté",
};

/** Délai réglementaire retenu par défaut, en jours, selon le type de demande. */
export const DELAI_PAR_TYPE = {
  transfert: 30,
  investissement: 45,
  emprunt: 60,
  compte_devises: 30,
  rapatriement: 30,
  autre: 30,
};

const PIECES_PAR_TYPE = {
  transfert: ["Formulaire de demande", "Facture / contrat", "Justificatif d'origine des fonds", "Attestation fiscale"],
  investissement: ["Formulaire de déclaration", "Statuts de la société", "Plan de financement", "Attestation bancaire"],
  emprunt: ["Convention de prêt", "Tableau d'amortissement", "Autorisation du conseil", "Attestation fiscale"],
  compte_devises: ["Formulaire de demande", "Registre de commerce", "Justificatif d'activité", "Attestation bancaire"],
  rapatriement: ["Déclaration d'exportation", "Facture définitive", "Attestation de domiciliation", "Relevé bancaire"],
  autre: ["Formulaire de demande", "Pièce justificative"],
};

export function piecesRequises(type) {
  return (PIECES_PAR_TYPE[type] ?? PIECES_PAR_TYPE.autre).map((label) => ({ label, fourni: false }));
}

export function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function ilYA(jours) {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  return iso(d);
}

/** Jeu de dossiers de démonstration, daté relativement au jour courant. */
export function donneesInitiales() {
  const ev = (auteur, action, joursAvant) => ({
    date: new Date(Date.now() - joursAvant * 86_400_000).toISOString(),
    auteur,
    action,
  });
  const mk = (n, demandeur, type, montant, devise, recuIlYA, analyste, statut, fournies) => ({
    id: newId(),
    reference: `DRC/SA/${new Date().getFullYear()}/${String(n).padStart(4, "0")}`,
    demandeur,
    type,
    montant,
    devise,
    dateReception: ilYA(recuIlYA),
    delaiReglementaire: DELAI_PAR_TYPE[type],
    analyste,
    statut,
    pieces: piecesRequises(type).map((p, i) => ({ ...p, fourni: i < fournies })),
    observations: "",
    version: 1,
    historique: [
      ev("admin", "Enregistrement du dossier au registre", recuIlYA),
      ...(analyste ? [ev("admin", `Attribution à ${analyste}`, recuIlYA)] : []),
    ],
  });

  const d = [
    mk(41, "Ondimba Marie‑Claire", "transfert", 185_000_000, "XAF", 27, "analyste", "en_instruction", 4),
    mk(42, "SOCAGI SA", "investissement", 2_400_000, "EUR", 19, "analyste", "en_instruction", 3),
    mk(43, "Bekolo & Fils SARL", "emprunt", 950_000, "USD", 21, "hierarchie", "en_instruction", 4),
    mk(44, "Nguema Ondo Pascal", "compte_devises", 0, "XAF", 14, "analyste", "en_attente_pieces", 2),
    mk(45, "Cotonnière du Tchad", "rapatriement", 1_120_000_000, "XAF", 8, null, "en_instruction", 3),
    mk(46, "Mbappé Ekani Justine", "transfert", 45_000_000, "XAF", 3, "analyste", "en_instruction", 1),
    mk(47, "Petro‑Congo Services", "emprunt", 5_000_000, "USD", 64, "hierarchie", "en_instruction", 4),
    mk(48, "Alliance Bâtiment SA", "transfert", 320_000_000, "XAF", 35, "analyste", "valide", 4),
  ];
  d[7].historique.push(ev("hierarchie", "Validation du dossier", 0));
  return d;
}

/* ------------------------------------------------------------------ */
/* Permissions — même règle des deux côtés                              */
/* ------------------------------------------------------------------ */

export const PERMISSIONS = {
  creer: (u) => u.role === "admin" || u.role === "analyste",
  editer: (u, d) => u.role === "admin" || (u.role === "analyste" && d.analyste === u.username),
  supprimer: (u, d) => u.role === "admin" || (u.role === "analyste" && d.analyste === u.username),
  decider: (u) => u.role === "admin" || u.role === "hierarchie",
  reassigner: (u) => u.role === "admin" || u.role === "hierarchie",
  importer: (u) => u.role === "admin",
};

const CLOS = ["valide", "rejete"];

/**
 * Vérifie qu'un utilisateur a le droit d'écrire `suivant` par-dessus `avant`.
 * Rend `null` si l'écriture est permise, sinon le motif du refus.
 *
 * Le contrôle est fait ici, côté service : masquer un bouton dans l'interface
 * ne protège rien, une requête peut toujours être forgée.
 */
export function refusEcriture(u, avant, suivant) {
  if (!avant) {
    if (!PERMISSIONS.creer(u)) return "Votre profil ne permet pas de créer un dossier.";
    if (u.role === "analyste" && suivant.analyste !== u.username)
      return "Un analyste ne peut créer un dossier que pour lui-même.";
    if (CLOS.includes(suivant.statut) && !PERMISSIONS.decider(u))
      return "Votre profil ne permet pas de clore un dossier.";
    return null;
  }

  const changeDecision = avant.statut !== suivant.statut && (CLOS.includes(avant.statut) || CLOS.includes(suivant.statut));
  const changeAnalyste = avant.analyste !== suivant.analyste;
  const changeReste = ["reference", "demandeur", "type", "montant", "devise", "dateReception", "delaiReglementaire", "observations"].some(
    (k) => JSON.stringify(avant[k]) !== JSON.stringify(suivant[k]),
  ) || JSON.stringify(avant.pieces) !== JSON.stringify(suivant.pieces);

  if (changeDecision && !PERMISSIONS.decider(u)) return "Seule la hiérarchie peut valider ou rejeter un dossier.";
  if (changeAnalyste && !(PERMISSIONS.reassigner(u) || PERMISSIONS.editer(u, avant)))
    return "Votre profil ne permet pas de réattribuer ce dossier.";
  if (changeReste && !PERMISSIONS.editer(u, avant))
    return "Ce dossier est attribué à un autre analyste : vous ne pouvez pas le modifier.";
  if (!changeDecision && !changeAnalyste && !changeReste) return null;
  return null;
}
