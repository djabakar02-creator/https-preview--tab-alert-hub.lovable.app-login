/**
 * Application de bureau BEAC‑DRC.
 *
 * Le processus principal démarre le service Ora sur un port libre de la boucle
 * locale, puis ouvre la fenêtre dessus. Tout reste sur le poste : aucune donnée
 * ne sort, sauf les questions posées à Ora lorsqu'un fournisseur distant est
 * configuré. Avec un modèle local (Ollama), rien ne quitte la machine.
 *
 * La clé éventuelle est lue dans ora.json, au dossier de configuration de
 * l'utilisateur, et n'est jamais transmise à la fenêtre.
 */
import { app, BrowserWindow, dialog, Menu, shell } from "electron";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { demarrer } from "../server/index.mjs";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = app.isPackaged ? join(process.resourcesPath, "dist") : join(ICI, "..", "dist");

const MODELE_CONF = {
  fournisseur: "gemini",
  cle: "",
  modele: "gemini-flash-latest",
  base: "",
};

let fenetre = null;
let service = null;

function cheminConf() {
  return join(app.getPath("userData"), "ora.json");
}

/** Lit la configuration du poste, en la créant au premier lancement. */
function lireConf() {
  const chemin = cheminConf();
  try {
    if (!existsSync(chemin)) {
      writeFileSync(chemin, JSON.stringify(MODELE_CONF, null, 2), "utf8");
      return { ...MODELE_CONF };
    }
    return { ...MODELE_CONF, ...JSON.parse(readFileSync(chemin, "utf8")) };
  } catch (e) {
    console.error("[bureau] ora.json illisible :", e.message);
    return { ...MODELE_CONF };
  }
}

function construireMenu(port) {
  const modele = [
    {
      label: "Fichier",
      submenu: [
        {
          label: "Configurer Ora…",
          click: () => shell.openPath(cheminConf()),
        },
        {
          label: "Ouvrir dans le navigateur",
          click: () => shell.openExternal(`http://127.0.0.1:${port}`),
        },
        { type: "separator" },
        { role: "quit", label: "Quitter" },
      ],
    },
    {
      label: "Édition",
      submenu: [
        { role: "undo", label: "Annuler" },
        { role: "redo", label: "Rétablir" },
        { type: "separator" },
        { role: "cut", label: "Couper" },
        { role: "copy", label: "Copier" },
        { role: "paste", label: "Coller" },
        { role: "selectAll", label: "Tout sélectionner" },
      ],
    },
    {
      label: "Affichage",
      submenu: [
        { role: "reload", label: "Recharger" },
        { role: "zoomIn", label: "Agrandir" },
        { role: "zoomOut", label: "Réduire" },
        { role: "resetZoom", label: "Taille normale" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Plein écran" },
        { role: "toggleDevTools", label: "Outils de développement" },
      ],
    },
    {
      label: "Aide",
      submenu: [
        {
          label: "À propos",
          click: () =>
            dialog.showMessageBox(fenetre, {
              type: "info",
              title: "À propos",
              message: "BEAC‑DRC · Suivi des dossiers d'autorisations",
              detail:
                `Version ${app.getVersion()}\n\n` +
                "Registre du Service des Autorisations, Direction de la Réglementation des Changes.\n\n" +
                "Les dossiers sont enregistrés sur ce poste uniquement. Pour un registre partagé " +
                "entre plusieurs agents, déployer l'application sur un serveur du réseau interne.",
              buttons: ["Fermer"],
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(modele));
}

async function creerFenetre() {
  const conf = lireConf();
  /* Port 0 : le système en attribue un libre, ce qui évite tout conflit. */
  const { serveur, port } = await demarrer({ ...conf, port: 0, racine: RACINE });
  service = serveur;

  fenetre = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#f7f4ee",
    title: "BEAC‑DRC · Suivi des dossiers d'autorisations",
    show: false,
    webPreferences: {
      /* La fenêtre n'exécute que l'application web : aucun accès à Node. */
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  construireMenu(port);
  fenetre.once("ready-to-show", () => fenetre.show());
  fenetre.on("closed", () => (fenetre = null));

  /* Toute navigation hors de l'application part dans le navigateur du poste. */
  const interne = (url) => url.startsWith(`http://127.0.0.1:${port}`);
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (!interne(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  fenetre.webContents.on("will-navigate", (e, url) => {
    if (!interne(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  await fenetre.loadURL(`http://127.0.0.1:${port}`);
  console.log(`[bureau] service local sur le port ${port} · Ora : ${conf.cle ? conf.fournisseur : "analyse locale"}`);
}

/* Une seule instance : un second lancement ramène la fenêtre existante. */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (fenetre) {
      if (fenetre.isMinimized()) fenetre.restore();
      fenetre.focus();
    }
  });

  app.whenReady().then(creerFenetre);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });

  app.on("window-all-closed", () => {
    service?.close();
    if (process.platform !== "darwin") app.quit();
  });
}
