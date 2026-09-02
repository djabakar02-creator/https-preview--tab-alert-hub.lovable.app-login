# BEAC‑DRC · Suivi des dossiers d'autorisations

Progiciel de suivi des dossiers du Service des Autorisations de la Direction de la
Réglementation des Changes (BEAC). Reprise en code source versionné de l'application
prototypée sur Lovable (`tab-alert-hub.lovable.app`).

## Démarrage

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production dans dist/
npm run preview    # sert dist/
npm test           # tests unitaires (délais, permissions, import CSV)
npm run typecheck
```

Copier `.env.example` en `.env` et renseigner `VITE_GEMINI_API_KEY` pour brancher Ora
sur Google AI Studio (Gemini). Sans clé, Ora fonctionne en mode local (analyse
déterministe du dossier). En cas de saturation (HTTP 503/429), plusieurs modèles sont
essayés avec nouvelle tentative, puis repli local.

## Profils

| Compte      | Mot de passe  | Droits                                                                 |
| ----------- | ------------- | ---------------------------------------------------------------------- |
| admin       | admin123      | Tout : création, édition, suppression, validation, réassignation, import |
| hierarchie  | hier123       | Contrôle hiérarchique : validation / rejet / réassignation, sans édition ni suppression |
| analyste    | analyste123   | Création (auto‑attribution), édition et suppression **de ses seuls dossiers** |
| lecture     | lecture123    | Consultation uniquement                                                 |

> Comptes de démonstration embarqués côté client. À remplacer par une authentification
> serveur avant toute mise en production.

## Règles métier

- **Délai** = date du jour − date de réception du document par la Banque Centrale.
  Rien n'est stocké : jours écoulés (J+n), échéance et délai restant sont recalculés à
  chaque rendu (`src/lib/delais.ts`).
- Niveaux : Conforme (> 10 j restants), À suivre (4–10 j), Urgent (≤ 3 j), Dépassé (< 0).
  Les dossiers validés ou rejetés sont « clos » et ne portent plus de niveau.
- Délais réglementaires par défaut selon le type de demande (`DELAI_PAR_TYPE`), modifiables
  par dossier.
- Chaque action (création, modification, validation, rejet, réattribution, import) est
  tracée dans l'historique du dossier.

## Persistance

Les dossiers sont conservés dans le `localStorage` du navigateur (`beac-drc:dossiers:v1`),
avec un jeu de données initial. Export et import CSV (séparateur `;` ou `,`) depuis les
onglets Rapports / Registre pour reprendre un registre tenu sous tableur. Le store est
isolé dans `src/lib/dossiers.ts` : remplacer `read`/`persist` par des appels API suffit
pour passer à une base de données.

## Structure

```
src/
  lib/          auth, permissions, délais, dossiers (store + CSV), ora, dates
  pages/        Login, Dashboard, Registre (fiche, formulaire, import), Rapports, Ora
  components/   Layout (en‑tête, horloge, navigation), ui (badges, modale)
public/fonts/   Archivo & Archivo Black embarquées (hors ligne)
```
