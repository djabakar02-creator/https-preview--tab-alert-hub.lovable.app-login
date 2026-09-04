/**
 * Modèle métier des dossiers, partagé par le navigateur et le service.
 * En JavaScript simple, pour être importé sans étape de compilation.
 *
 * Les types d'opération et leurs sous-catégories proviennent du catalogue du
 * Service des Autorisations (Autorisations_Ops.xlsx). Les intitulés longs sont
 * ceux du service ; les intitulés courts servent aux tableaux et aux filtres.
 */

/** Intitulé officiel, tel qu'il figure au catalogue du service. */
export const TYPE_LABELS = {
  immobilier_hors_cemac:
    "Demande d'autorisation pour acquisition immobilière hors CEMAC de biens immobiliers par les résidents",
  investissement_direct:
    "Demande d'autorisation pour une opération d'investissement direct à l'étranger autre que celle portant sur l'immobilier (ex : prise de participation / création d'entreprise)",
  pret_non_resident:
    "Demande d'autorisation de prêt d'un résident (autre qu'un Ets de crédit/État) à un non-résident",
  portefeuille_sortant:
    "Demande d'autorisation de réalisation des investissements de portefeuille sortants d'un montant supérieur à 20 millions F CFA",
  valeurs_mobilieres:
    "Demande d'autorisation pour les opérations relatives aux valeurs mobilières (émission/publicité, souscription/transfert)",
  bureau_de_change: "Demande d'avis conforme de bureau de change",
  import_billets: "Demande d'autorisation d'importation de billets de banque étrangers",
  compte_devises_cemac:
    "Demande d'autorisation d'ouverture de compte en devise des personnes morales résidentes dans la CEMAC",
  compte_devises_hors_cemac:
    "Demande d'autorisation d'ouverture de compte en devise par les personnes morales résidentes hors de la CEMAC",
};

/** Intitulé court, pour les colonnes, les puces de filtre et les exports. */
export const TYPE_COURT = {
  immobilier_hors_cemac: "Acquisition immobilière hors CEMAC",
  investissement_direct: "Investissement direct à l'étranger",
  pret_non_resident: "Prêt à un non-résident",
  portefeuille_sortant: "Investissement de portefeuille sortant",
  valeurs_mobilieres: "Valeurs mobilières",
  bureau_de_change: "Avis conforme de bureau de change",
  import_billets: "Importation de billets étrangers",
  compte_devises_cemac: "Compte en devises · résident CEMAC",
  compte_devises_hors_cemac: "Compte en devises · résident hors CEMAC",
};

/** Sous-catégories du catalogue, pour les deux types qui en portent. */
export const SOUS_TYPES = {
  valeurs_mobilieres: [
    "Pour les émissions/publicité de VM",
    "Pour les souscriptions aux VM par des résidents et les transferts vers l'extérieur des produits afférents",
  ],
  bureau_de_change: [
    "Pour le bureau de change à agréer",
    "Pour le gérant ou dirigeant",
    "Si Promoteur personne physique",
    "Si Promoteur personne morale",
  ],
};

/**
 * Délai réglementaire par type.
 *
 * `source: "instruction"` — le délai figure dans une instruction du
 *                            Gouverneur publiée, citée dans `reference`. La
 *                            confirmation la plus sûre : un texte signé.
 * `source: "catalogue"`   — le délai figure au catalogue du service, sans
 *                            texte réglementaire cité en regard.
 * `source: "defaut"`      — VALEUR DE TRAVAIL, à confirmer par le service. Ni
 *                            le catalogue ni aucune instruction connue ne la
 *                            précise, et un délai réglementaire ne s'invente
 *                            pas. Elle reste modifiable dossier par dossier.
 *
 * `ouvres: true` compte en jours ouvrés (samedi et dimanche exclus).
 */
export const DELAIS = {
  immobilier_hors_cemac: { jours: 30, ouvres: false, source: "defaut" },
  investissement_direct: { jours: 30, ouvres: false, source: "defaut" },
  pret_non_resident: { jours: 30, ouvres: false, source: "defaut" },
  portefeuille_sortant: { jours: 60, ouvres: true, source: "catalogue" },
  valeurs_mobilieres: { jours: 30, ouvres: false, source: "defaut" },
  bureau_de_change: { jours: 30, ouvres: false, source: "defaut" },
  import_billets: {
    jours: 30,
    ouvres: true,
    source: "instruction",
    reference: "Instruction n° 001/GR/2019 du 10 juin 2019, art. 4",
  },
  compte_devises_cemac: { jours: 30, ouvres: false, source: "defaut" },
  compte_devises_hors_cemac: { jours: 30, ouvres: false, source: "defaut" },
};

export const DELAI_PAR_TYPE = Object.fromEntries(Object.entries(DELAIS).map(([k, v]) => [k, v.jours]));

/** Le délai de ce type se compte-t-il en jours ouvrés ? */
export const estEnJoursOuvres = (type) => Boolean(DELAIS[type]?.ouvres);

export const STATUT_LABELS = {
  en_instruction: "En instruction",
  en_attente_pieces: "En attente de pièces",
  valide: "Validé",
  rejete: "Rejeté",
};

/**
 * Liste de pièces par défaut.
 *
 * Le catalogue transmis ne porte que les intitulés des opérations : la liste
 * des pièces exigées pour chaque type reste à fournir par le service. En
 * attendant, cette trame générique permet de suivre la complétude sans
 * présenter comme officielle une liste qui ne l'est pas.
 */
const PIECES_PAR_TYPE = {
  bureau_de_change: [
    "Formulaire de demande",
    "Dossier du bureau de change à agréer",
    "Dossier du gérant ou dirigeant",
    "Dossier du promoteur",
  ],
};

const PIECES_GENERIQUES = [
  "Formulaire de demande",
  "Pièces justificatives de l'opération",
  "Justificatifs du demandeur",
];

export function piecesRequises(type) {
  return (PIECES_PAR_TYPE[type] ?? PIECES_GENERIQUES).map((label) => ({ label, fourni: false }));
}

/**
 * Correspondance depuis l'ancien jeu de types.
 *
 * Seules les équivalences certaines figurent ici. « Transfert de fonds »,
 * « Rapatriement de recettes » et « Autre demande » n'ont pas de contrepartie
 * au catalogue : les convertir reviendrait à ranger un dossier sous une
 * catégorie réglementaire qui n'est peut-être pas la sienne. Ils sont donc
 * signalés à l'import, pour que l'agent les requalifie lui-même.
 */
const ANCIENS_TYPES = {
  investissement: "investissement_direct",
  emprunt: "pret_non_resident",
  compte_devises: "compte_devises_cemac",
};

export function normaliserType(type) {
  if (type in TYPE_LABELS) return type;
  return ANCIENS_TYPES[type] ?? null;
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
  const mk = (n, demandeur, type, sousType, montant, devise, recuIlYA, analyste, statut, fournies) => ({
    id: newId(),
    reference: `DRC/SA/${new Date().getFullYear()}/${String(n).padStart(4, "0")}`,
    demandeur,
    type,
    sousType,
    montant,
    devise,
    dateReception: ilYA(recuIlYA),
    delaiReglementaire: DELAIS[type].jours,
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
    mk(41, "Ondimba Marie‑Claire", "immobilier_hors_cemac", null, 185_000_000, "XAF", 27, "analyste", "en_instruction", 3),
    mk(42, "SOCAGI SA", "investissement_direct", null, 2_400_000, "EUR", 19, "analyste", "en_instruction", 2),
    mk(43, "Bekolo & Fils SARL", "pret_non_resident", null, 950_000, "USD", 21, "hierarchie", "en_instruction", 3),
    mk(44, "Nguema Ondo Pascal", "compte_devises_cemac", null, 0, "XAF", 14, "analyste", "en_attente_pieces", 1),
    mk(45, "Cotonnière du Tchad", "portefeuille_sortant", null, 1_120_000_000, "XAF", 8, null, "en_instruction", 2),
    mk(46, "Mbappé Ekani Justine", "valeurs_mobilieres", SOUS_TYPES.valeurs_mobilieres[0], 45_000_000, "XAF", 3, "analyste", "en_instruction", 1),
    mk(47, "Petro‑Congo Services", "import_billets", null, 5_000_000, "USD", 64, "hierarchie", "en_instruction", 3),
    mk(48, "Alliance Bâtiment SA", "compte_devises_hors_cemac", null, 320_000_000, "XAF", 35, "analyste", "valide", 3),
    mk(49, "Change Express SARL", "bureau_de_change", SOUS_TYPES.bureau_de_change[0], 0, "XAF", 11, "analyste", "en_instruction", 2),
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
  const changeReste =
    ["reference", "demandeur", "type", "sousType", "montant", "devise", "dateReception", "delaiReglementaire", "observations"].some(
      (k) => JSON.stringify(avant[k]) !== JSON.stringify(suivant[k]),
    ) || JSON.stringify(avant.pieces) !== JSON.stringify(suivant.pieces);

  if (changeDecision && !PERMISSIONS.decider(u)) return "Seule la hiérarchie peut valider ou rejeter un dossier.";
  if (changeAnalyste && !(PERMISSIONS.reassigner(u) || PERMISSIONS.editer(u, avant)))
    return "Votre profil ne permet pas de réattribuer ce dossier.";
  if (changeReste && !PERMISSIONS.editer(u, avant))
    return "Ce dossier est attribué à un autre analyste : vous ne pouvez pas le modifier.";
  return null;
}
