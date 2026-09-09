import { formatClock, formatDateFR, formatEdition, formatLongDateFR } from "./dates";
import { delaiDuDossier, NIVEAU_LABELS } from "./delais";
import { STATUT_LABELS, TYPE_LABELS, type Dossier } from "./dossiers";
import type { Rapport } from "./rapport";
import { telechargerFichier, type CanalTelechargement } from "./telechargement";

/**
 * Documents remis aux agents : synthèse PDF et classeur tableur.
 *
 * Les deux reprennent l'identité du registre — filet rouge, bandeau noir,
 * capitales espacées — pour qu'une pièce imprimée reste reconnaissable dans un
 * dossier papier. Les bibliothèques sont chargées à la demande : elles pèsent
 * lourd et ne servent qu'au moment de l'export.
 */

const ENCRE = "#0A0A0A";
const ROUGE = "#D10F1C";
const PAPIER = "#F7F4EE";
const SABLE = "#ECE5D9";

/* jsPDF encode en WinAnsi : les tirets longs et les espaces fines insécables
   n'y figurent pas et sortiraient en caractères parasites. */
const pourPDF = (s: string) => s.replace(/[‑–—]/g, "-").replace(/→/g, "->").replace(/[  ]/g, " ");
/* toLocaleString produit une espace fine insécable, que l'encodage WinAnsi de
   jsPDF rend « / ». On la ramène à une espace ordinaire. */
const nombre = (n: number) => n.toLocaleString("fr-FR").replace(/[\u202F\u00A0]/g, " ");

function nomFichier(extension: string): string {
  return `registre-drc-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

/** Lignes du registre détaillé, communes aux deux formats. */
function lignesRegistre(dossiers: Dossier[]) {
  return dossiers.map((d) => {
    const c = delaiDuDossier(d);
    const clos = d.statut === "valide" || d.statut === "rejete";
    return {
      reference: d.reference,
      demandeur: d.demandeur,
      type: TYPE_LABELS[d.type],
      montant: d.montant,
      devise: d.devise,
      reception: d.dateReception,
      echeance: c.echeance,
      ecoule: c.joursEcoules,
      restant: clos ? null : c.delaiRestant,
      niveau: clos ? "Clos" : NIVEAU_LABELS[c.niveau],
      analyste: d.analyste ?? "Non attribué",
      statut: STATUT_LABELS[d.statut],
      pieces: `${d.pieces.filter((p) => p.fourni).length}/${d.pieces.length}`,
      observations: d.observations,
    };
  });
}

/* ------------------------------------------------------------------ */
/* PDF                                                                  */
/* ------------------------------------------------------------------ */

export async function exporterPDF(rapport: Rapport, dossiers: Dossier[]): Promise<CanalTelechargement> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = doc.internal.pageSize.getWidth();
  const M = 14;
  const today = new Date();

  /* En-tête éditorial, repris de l'écran de connexion. */
  doc.setFillColor(ROUGE).rect(0, 0, L, 3, "F");
  doc.setFillColor(PAPIER).rect(0, 3, L, 30, "F");

  doc.setTextColor(ENCRE).setFont("helvetica", "bold").setFontSize(6.5);
  doc.text("B E A C   ·   D I R E C T I O N   D E   L A   R É G L E M E N T A T I O N   D E S   C H A N G E S", M, 11);
  doc.setFontSize(20).text("BEAC-DRC", M, 21);
  doc.setTextColor(ROUGE).setFontSize(11).text("Autorisations", M + 41, 21);

  doc.setTextColor(ENCRE).setFont("helvetica", "bold").setFontSize(6.5);
  doc.text("É D I T I O N", L - M, 11, { align: "right" });
  doc.setFontSize(10).text(`Nº ${formatEdition(today)}`, L - M, 16, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(7.5);
  doc.text(pourPDF(formatLongDateFR(today)), L - M, 21, { align: "right" });

  doc.setDrawColor(ENCRE).setLineWidth(0.3).line(M, 27, L - M, 27);
  doc.setFont("helvetica", "bold").setFontSize(15).text("Synthèse du registre", M, 32);

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(90, 86, 78);
  doc.text(`Périmètre : ${pourPDF(rapport.perimetre)}`, M, 39);
  doc.text(`Généré le ${formatClock(rapport.genereLe)}`, L - M, 39, { align: "right" });

  /* Bandeau d'indicateurs. */
  const kpis = [
    ["Dossiers", nombre(rapport.total)],
    ["En cours", nombre(rapport.enCours)],
    ["Délai moyen", rapport.delaiMoyen === null ? "—" : `${rapport.delaiMoyen} j`],
    ["Dans les délais", rapport.tauxRespect === null ? "—" : `${rapport.tauxRespect} %`],
    ["Complétude", rapport.completude === null ? "—" : `${rapport.completude} %`],
  ];
  const largeur = (L - 2 * M) / kpis.length;
  kpis.forEach(([libelle, valeur], i) => {
    const x = M + i * largeur;
    doc.setFillColor(SABLE).rect(x, 43, largeur - 1.5, 16, "F");
    doc.setFont("helvetica", "bold").setFontSize(6).setTextColor(90, 86, 78);
    doc.text(libelle.toUpperCase(), x + 3, 48.5);
    const alerte = libelle === "Dans les délais" && rapport.tauxRespect !== null && rapport.tauxRespect < 80;
    doc.setFontSize(13).setTextColor(alerte ? ROUGE : ENCRE);
    doc.text(valeur, x + 3, 55.5);
  });

  const styleTable = {
    theme: "grid" as const,
    headStyles: { fillColor: ENCRE, textColor: "#FFFFFF", fontSize: 7, fontStyle: "bold" as const, cellPadding: 1.8 },
    bodyStyles: { fontSize: 7.5, cellPadding: 1.8, textColor: ENCRE },
    alternateRowStyles: { fillColor: PAPIER },
    styles: { lineColor: "#C9C1B2", lineWidth: 0.1, font: "helvetica" },
    margin: { left: M, right: M },
  };

  const H = doc.internal.pageSize.getHeight();
  const PIED = 20;
  let y = 70;

  const filetHaut = () => doc.setFillColor(ROUGE).rect(0, 0, L, 3, "F");

  /**
   * Ouvre une section. Si la place restante ne suffit pas au titre suivi d'au
   * moins trois lignes, on passe à la page suivante : un tableau ne doit pas
   * laisser une ligne orpheline sur une page vide.
   */
  const titre = (texte: string, lignes = 3) => {
    const requis = 10 + 8 + Math.min(lignes, 4) * 7;
    if (y + requis > H - PIED) {
      doc.addPage();
      filetHaut();
      y = 18;
    }
    /* Filet au-dessus du titre : jamais sous le texte, où il barrerait les
       jambages des lettres. */
    doc.setDrawColor(ROUGE).setLineWidth(0.7).line(M, y - 3.4, M + 14, y - 3.4);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(ENCRE);
    doc.text(pourPDF(texte), M, y);
  };

  const finTable = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  titre("Répartition par niveau de délai", rapport.parNiveau.length);
  autoTable(doc, {
    ...styleTable,
    startY: y + 4,
    rowPageBreak: "avoid" as const,
    head: [["Niveau", "Dossiers en cours", "Part"]],
    body: rapport.parNiveau.map((n) => [n.libelle, nombre(n.nombre), `${n.part} %`]),
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });

  y = finTable() + 12;
  titre("Répartition par statut", rapport.parStatut.length);
  autoTable(doc, {
    ...styleTable,
    startY: y + 4,
    rowPageBreak: "avoid" as const,
    head: [["Statut", "Dossiers", "Part"]],
    body: rapport.parStatut.map((s) => [s.libelle, nombre(s.nombre), `${s.part} %`]),
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });

  y = finTable() + 12;
  titre("Détail par type d'opération", rapport.parType.length);
  autoTable(doc, {
    ...styleTable,
    startY: y + 4,
    rowPageBreak: "avoid" as const,
    head: [["Type d'opération", "Total", "En cours", "Clos", "Délai moyen", "Urgents", "Dépassés", "Pièces"]],
    body: rapport.parType.map((t) => [
      t.libelle,
      nombre(t.total),
      nombre(t.enCours),
      nombre(t.clos),
      t.delaiMoyen === null ? "—" : `${t.delaiMoyen} j`,
      nombre(t.urgents),
      nombre(t.depasses),
      `${t.completude} %`,
    ]),
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
  });

  y = finTable() + 12;
  titre("Charge par analyste", rapport.parAnalyste.length);
  autoTable(doc, {
    ...styleTable,
    startY: y + 4,
    rowPageBreak: "avoid" as const,
    head: [["Analyste", "En cours", "Urgents", "Dépassés", "Délai le plus court"]],
    body: rapport.parAnalyste.map((a) => [
      a.analyste,
      nombre(a.enCours),
      nombre(a.urgents),
      nombre(a.depasses),
      a.delaiMin === null ? "—" : `${a.delaiMin} j`,
    ]),
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  const traites = rapport.parAnalyste.filter((a) => a.traites > 0);
  if (traites.length) {
    y = finTable() + 12;
    titre("Performance par analyste (dossiers clos, réception → clôture)", traites.length);
    autoTable(doc, {
      ...styleTable,
      startY: y + 4,
      rowPageBreak: "avoid" as const,
      head: [["Analyste", "Traités", "Validés", "Rejetés", "Délai moyen", "Dans les délais"]],
      body: traites.map((a) => [
        a.analyste,
        nombre(a.traites),
        nombre(a.valides),
        nombre(a.rejetes),
        a.delaiTraitementMoyen === null ? "—" : `${a.delaiTraitementMoyen} j`,
        a.tauxDansLesDelais === null ? "—" : `${a.tauxDansLesDelais} %`,
      ]),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      /* Un taux de respect des délais faible doit sauter aux yeux, ici comme
         à l'écran. */
      didParseCell: (data) => {
        if (data.section !== "body" || data.column.index !== 5) return;
        const brut = Number(String(data.cell.raw ?? "").replace(/[^\d.-]/g, ""));
        if (Number.isFinite(brut) && brut < 50) {
          data.cell.styles.textColor = ROUGE;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  }

  if (rapport.parDevise.length) {
    y = finTable() + 12;
    titre("Montants par devise", rapport.parDevise.length);
    autoTable(doc, {
      ...styleTable,
      startY: y + 4,
    rowPageBreak: "avoid" as const,
      head: [["Devise", "Dossiers", "Montant cumulé"]],
      body: rapport.parDevise.map((d) => [d.devise, nombre(d.nombre), nombre(d.montant)]),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });
  }

  /* Registre détaillé, sur ses propres pages. */
  doc.addPage();
  filetHaut();
  y = 16;
  titre("Registre détaillé", 0);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(90, 86, 78);
  doc.text(`${dossiers.length} dossier(s) · ${pourPDF(rapport.perimetre)}`, M, 22);

  autoTable(doc, {
    ...styleTable,
    startY: 27,
    head: [["Référence", "Demandeur", "Type", "Réception", "Échéance", "Écoulé", "Restant", "Niveau", "Analyste", "Statut", "Pièces"]],
    body: lignesRegistre(dossiers).map((l) => [
      l.reference,
      l.demandeur,
      l.type,
      formatDateFR(l.reception),
      formatDateFR(l.echeance),
      `J+${l.ecoule}`,
      l.restant === null ? "—" : `${l.restant} j`,
      l.niveau,
      l.analyste,
      l.statut,
      l.pieces,
    ]),
    bodyStyles: { ...styleTable.bodyStyles, fontSize: 6.5 },
    headStyles: { ...styleTable.headStyles, fontSize: 6 },
    columnStyles: {
      0: { cellWidth: 26 },
      5: { halign: "right" },
      6: { halign: "right" },
      10: { halign: "center" },
    },
    /* Un dossier hors délai doit sauter aux yeux sur le papier. */
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const brut = data.row.raw;
      const niveau = Array.isArray(brut) ? String(brut[7] ?? "") : "";
      if (niveau !== "Dépassé") return;
      data.cell.styles.textColor = ROUGE;
      if (data.column.index === 7) data.cell.styles.fontStyle = "bold";
    },
  });

  /* Pied de page sur chaque page. */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(ENCRE).setLineWidth(0.2).line(M, H - 12, L - M, H - 12);
    doc.setFont("helvetica", "bold").setFontSize(6).setTextColor(90, 86, 78);
    doc.text("S E R V I C E   D E S   A U T O R I S A T I O N S", M, H - 8);
    doc.text("U S A G E   R É S E R V É", L / 2, H - 8, { align: "center" });
    doc.text(`${p} / ${pages}`, L - M, H - 8, { align: "right" });
  }

  return telechargerFichier(nomFichier("pdf"), doc.output("blob"), "application/pdf");
}

/* ------------------------------------------------------------------ */
/* Classeur tableur                                                     */
/* ------------------------------------------------------------------ */

type Feuille = import("exceljs").Worksheet;

const HEX = (c: string) => c.replace("#", "FF");

function enTete(f: Feuille, ligne: number, colonnes: string[]) {
  const r = f.getRow(ligne);
  colonnes.forEach((c, i) => {
    const cell = r.getCell(i + 1);
    cell.value = c;
    cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEX(ENCRE) } };
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "right", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: HEX(ROUGE) } } };
  });
  r.height = 22;
}

function bandeau(f: Feuille, titre: string, sousTitre: string, colonnes: number) {
  f.mergeCells(1, 1, 1, colonnes);
  const t = f.getCell(1, 1);
  t.value = "BEAC-DRC · AUTORISATIONS";
  t.font = { bold: true, size: 8, color: { argb: HEX(ROUGE) }, name: "Calibri" };
  f.getRow(1).height = 18;

  f.mergeCells(2, 1, 2, colonnes);
  const s = f.getCell(2, 1);
  s.value = titre;
  s.font = { bold: true, size: 16, color: { argb: HEX(ENCRE) }, name: "Calibri" };
  f.getRow(2).height = 26;

  f.mergeCells(3, 1, 3, colonnes);
  const u = f.getCell(3, 1);
  u.value = sousTitre;
  u.font = { size: 9, color: { argb: "FF5C574E" }, italic: true, name: "Calibri" };
  f.getRow(3).height = 16;
  f.getRow(4).height = 6;
}

export async function exporterXLSX(rapport: Rapport, dossiers: Dossier[]): Promise<CanalTelechargement> {
  const ExcelJS = await import("exceljs");
  const classeur = new ExcelJS.Workbook();
  classeur.creator = "BEAC · Direction de la Réglementation des Changes";
  classeur.created = rapport.genereLe;

  const sousTitre = `${rapport.perimetre} · généré le ${formatClock(rapport.genereLe)}`;

  /* --- Feuille 1 : synthèse --- */
  const synthese = classeur.addWorksheet("Synthèse", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: { oddFooter: "&LService des Autorisations&CUsage réservé&RPage &P / &N" },
  });
  synthese.columns = [{ width: 46 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 15 }, { width: 12 }, { width: 12 }, { width: 12 }];
  bandeau(synthese, "Synthèse du registre", sousTitre, 8);

  let l = 5;
  const indicateurs: [string, string | number][] = [
    ["Dossiers au registre", rapport.total],
    ["Dossiers en cours", rapport.enCours],
    ["Dossiers clos", rapport.clos],
    ["Délai restant moyen (jours)", rapport.delaiMoyen ?? "—"],
    ["Délai restant médian (jours)", rapport.delaiMedian ?? "—"],
    ["Délai restant le plus court (jours)", rapport.delaiMin ?? "—"],
    ["Dossiers dans les délais (%)", rapport.tauxRespect ?? "—"],
    ["Complétude des pièces (%)", rapport.completude ?? "—"],
    ["Dossiers complets", rapport.dossiersComplets],
    ["Pièces manquantes", rapport.piecesManquantes],
    ["Dossiers non attribués", rapport.nonAttribues],
    ["Ancienneté du plus ancien dossier en cours (jours)", rapport.ancienneteMax ?? "—"],
  ];
  enTete(synthese, l++, ["Indicateur", "Valeur"]);
  for (const [libelle, valeur] of indicateurs) {
    const r = synthese.getRow(l++);
    r.getCell(1).value = libelle;
    r.getCell(2).value = valeur;
    r.getCell(2).alignment = { horizontal: "right" };
    r.getCell(2).font = { bold: true, name: "Calibri" };
    if (l % 2 === 0) {
      for (let c = 1; c <= 2; c++) r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEX(PAPIER) } };
    }
  }

  /** Écrit un bloc titré ; renvoie la plage de lignes de données, pour une mise en forme conditionnelle éventuelle. */
  const bloc = <T,>(titre: string, colonnes: string[], lignes: T[], valeurs: (x: T) => (string | number)[]) => {
    l += 2;
    const t = synthese.getCell(l, 1);
    t.value = titre;
    t.font = { bold: true, size: 11, color: { argb: HEX(ENCRE) }, name: "Calibri" };
    l += 1;
    enTete(synthese, l++, colonnes);
    const debut = l;
    for (const x of lignes) {
      const r = synthese.getRow(l++);
      valeurs(x).forEach((v, i) => {
        const cell = r.getCell(i + 1);
        cell.value = v;
        if (i > 0) cell.alignment = { horizontal: "right" };
      });
      if (l % 2 === 0) {
        for (let c = 1; c <= colonnes.length; c++) r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEX(PAPIER) } };
      }
    }
    return { debut, fin: l - 1 };
  };

  bloc("Par niveau de délai (dossiers en cours)", ["Niveau", "Dossiers", "Part (%)"], rapport.parNiveau, (n) => [n.libelle, n.nombre, n.part]);
  bloc("Par statut", ["Statut", "Dossiers", "Part (%)"], rapport.parStatut, (s) => [s.libelle, s.nombre, s.part]);
  bloc(
    "Par type d'opération",
    ["Type d'opération", "Total", "En cours", "Clos", "Délai moyen (j)", "Urgents", "Dépassés", "Pièces (%)"],
    rapport.parType,
    (t) => [t.libelle, t.total, t.enCours, t.clos, t.delaiMoyen ?? "—", t.urgents, t.depasses, t.completude],
  );
  bloc("Charge par analyste (dossiers en cours)", ["Analyste", "En cours", "Urgents", "Dépassés", "Délai le plus court (j)"], rapport.parAnalyste, (a) => [
    a.analyste,
    a.enCours,
    a.urgents,
    a.depasses,
    a.delaiMin ?? "—",
  ]);

  const traites = rapport.parAnalyste.filter((a) => a.traites > 0);
  if (traites.length) {
    const { debut, fin } = bloc(
      "Performance par analyste (dossiers clos, réception → clôture)",
      ["Analyste", "Traités", "Validés", "Rejetés", "Délai moyen (j)", "Dans les délais (%)"],
      traites,
      (a) => [a.analyste, a.traites, a.valides, a.rejetes, a.delaiTraitementMoyen ?? "—", a.tauxDansLesDelais ?? "—"],
    );
    /* Barre de données sur le taux de respect des délais : le classeur se lit
       d'un coup d'œil, sans avoir à comparer les chiffres colonne par colonne.
       `color` est bien lu par ExcelJS à l'écriture (databar-xform.js), mais
       absent de ses définitions de types : l'échappement ci-dessous comble
       cette seule lacune, sans affaiblir le contrôle de type du reste. */
    synthese.addConditionalFormatting({
      ref: `F${debut}:F${fin}`,
      rules: [
        {
          type: "dataBar",
          priority: 1,
          gradient: false,
          minLength: 0,
          maxLength: 100,
          cfvo: [
            { type: "num", value: 0 },
            { type: "num", value: 100 },
          ],
          color: { argb: HEX(ENCRE) },
        } as import("exceljs").DataBarRuleType & { color: { argb: string } },
      ],
    });
  }

  if (rapport.parDevise.length) {
    bloc("Montants par devise", ["Devise", "Dossiers", "Montant cumulé"], rapport.parDevise, (d) => [d.devise, d.nombre, d.montant]);
  }
  bloc("Réceptions par mois", ["Mois", "Dossiers reçus"], rapport.parMois, (m) => [m.libelle, m.nombre]);

  /* --- Feuille 2 : registre détaillé --- */
  const detail = classeur.addWorksheet("Registre", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 6 }],
    pageSetup: {
      paperSize: 9,
      /* Quatorze colonnes : le paysage ajusté à la largeur est le seul rendu
         imprimable, et la ligne d'en-tête se répète sur chaque page. */
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "6:6",
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
    headerFooter: { oddFooter: "&LRegistre détaillé&CUsage réservé&RPage &P / &N" },
  });
  const COLS = [
    { t: "Référence", w: 22 },
    { t: "Demandeur", w: 28 },
    { t: "Type d'opération", w: 36 },
    { t: "Montant", w: 16 },
    { t: "Devise", w: 9 },
    { t: "Réception", w: 13 },
    { t: "Échéance", w: 13 },
    { t: "Écoulé (j)", w: 11 },
    { t: "Restant (j)", w: 11 },
    { t: "Niveau", w: 13 },
    { t: "Analyste", w: 15 },
    { t: "Statut", w: 19 },
    { t: "Pièces", w: 9 },
    { t: "Observations", w: 40 },
  ];
  detail.columns = COLS.map((c) => ({ width: c.w }));
  bandeau(detail, "Registre détaillé", `${dossiers.length} dossier(s) · ${sousTitre}`, COLS.length);
  enTete(detail, 6, COLS.map((c) => c.t));

  const TEINTES: Record<string, string> = {
    Dépassé: "FFF6D6D8",
    Urgent: "FFFCE6C8",
    "À suivre": "FFFAF3D0",
  };

  lignesRegistre(dossiers).forEach((x, i) => {
    const r = detail.getRow(7 + i);
    r.values = [
      x.reference,
      x.demandeur,
      x.type,
      x.montant || null,
      x.devise,
      new Date(x.reception),
      new Date(x.echeance),
      x.ecoule,
      x.restant,
      x.niveau,
      x.analyste,
      x.statut,
      x.pieces,
      x.observations || null,
    ];
    r.getCell(4).numFmt = "#,##0";
    r.getCell(6).numFmt = "dd/mm/yyyy";
    r.getCell(7).numFmt = "dd/mm/yyyy";
    for (const c of [8, 9, 13]) r.getCell(c).alignment = { horizontal: "right" };
    r.getCell(10).alignment = { horizontal: "center" };

    const teinte = TEINTES[x.niveau];
    if (teinte) r.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: teinte } };
    if (x.niveau === "Dépassé") {
      r.getCell(9).font = { bold: true, color: { argb: HEX(ROUGE) }, name: "Calibri" };
      r.getCell(10).font = { bold: true, color: { argb: HEX(ROUGE) }, name: "Calibri" };
    } else if (i % 2) {
      for (let c = 1; c <= COLS.length; c++) {
        if (c !== 10) r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEX(PAPIER) } };
      }
    }
  });

  detail.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6 + dossiers.length, column: COLS.length } };

  const tampon = await classeur.xlsx.writeBuffer();
  const type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return telechargerFichier(nomFichier("xlsx"), new Blob([tampon], { type }), type);
}
