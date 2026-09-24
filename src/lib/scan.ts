import type { ScanCourrier } from "./dossiers";

/**
 * Marge sous la limite de 8 Mio du service (le fichier gonfle d'environ un
 * tiers une fois encodé en base64, et le dossier qui le porte pèse un peu
 * plus lourd que le seul scan).
 */
export const TAILLE_MAX_SCAN = 5 * 1024 * 1024;

/** Lit un fichier choisi par l'agent en scan du courrier, prêt à joindre au dossier. */
export function lireFichierScan(file: File, chargePar: string): Promise<ScanCourrier> {
  if (file.size > TAILLE_MAX_SCAN) {
    return Promise.reject(
      new Error(
        `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo) : la taille maximale est de ${TAILLE_MAX_SCAN / 1024 / 1024} Mo.`,
      ),
    );
  }
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error("Lecture du fichier impossible."));
    lecteur.onload = () => {
      resolve({
        nom: file.name,
        type: file.type || "application/octet-stream",
        taille: file.size,
        donnees: String(lecteur.result),
        dateChargement: new Date().toISOString(),
        chargePar,
      });
    };
    lecteur.readAsDataURL(file);
  });
}
