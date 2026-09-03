import { useEffect, useSyncExternalStore } from "react";

/**
 * Thème de l'interface. « Système » suit le réglage du poste ; les deux autres
 * l'emportent. Le choix est propre à chaque agent et tient dans son navigateur.
 */
export type Theme = "clair" | "sombre" | "systeme";

export const THEME_LABELS: Record<Theme, string> = {
  clair: "Clair",
  sombre: "Sombre",
  systeme: "Système",
};

const CLE = "beac-drc:theme:v1";
const listeners = new Set<() => void>();
let theme: Theme = lireStocke();

function lireStocke(): Theme {
  try {
    const v = localStorage.getItem(CLE);
    if (v === "clair" || v === "sombre" || v === "systeme") return v;
  } catch {
    /* stockage indisponible : on suit le système */
  }
  return "systeme";
}

const prefereSombre = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

/** Thème réellement appliqué, une fois « système » résolu. */
export function themeEffectif(t: Theme = theme): "clair" | "sombre" {
  return t === "systeme" ? (prefereSombre() ? "sombre" : "clair") : t;
}

function appliquer() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.apparence = themeEffectif();
}

export function definirTheme(t: Theme) {
  theme = t;
  try {
    localStorage.setItem(CLE, t);
  } catch {
    /* le choix ne survivra pas à la session, sans conséquence */
  }
  appliquer();
  listeners.forEach((l) => l());
}

/** Applique le thème dès le premier rendu, avant que React ne monte. */
export function initialiserTheme() {
  appliquer();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const snapshot = () => theme;

export function useTheme(): [Theme, (t: Theme) => void] {
  const courant = useSyncExternalStore(subscribe, snapshot, snapshot);
  /* En mode « système », le réglage du poste peut changer en cours de session. */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const surChangement = () => {
      if (snapshot() === "systeme") {
        appliquer();
        listeners.forEach((l) => l());
      }
    };
    mq.addEventListener("change", surChangement);
    return () => mq.removeEventListener("change", surChangement);
  }, []);
  return [courant, definirTheme];
}
