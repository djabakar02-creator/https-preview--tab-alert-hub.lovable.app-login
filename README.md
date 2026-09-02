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
npm run build:single  # dist/beac-drc.html : l'application en un seul fichier (recette, hors ligne)
npm run build:demo    # idem, sans la clé Gemini embarquée (hébergement tiers)
npm test           # tests unitaires (délais, permissions, import CSV)
npm run typecheck
```

`build:single` compile avec un routage par ancre (`VITE_ROUTER=hash`) et embarque JS, CSS et polices
dans un seul fichier HTML ouvrable sans serveur.

## Ora, assistante d'instruction

Ora est le volet conversationnel de l'application. Sa persona, ses compétences et ses
règles de conduite sont définies dans `src/lib/ora.ts` : cadre CEMAC (Règlement
n° 02/18/CEMAC/UMAC/CM), qualification des demandes, contrôle de complétude, suivi des
délais, aide à la décision.

Deux garde-fous sont inscrits dans ses instructions :

- elle reprend le délai restant **calculé par le registre** et ne le recalcule jamais ;
- elle n'invente **aucun** numéro d'article, seuil ou délai réglementaire ; si une
  disposition lui manque, elle le dit au lieu de la supposer.

**Trois moteurs**, essayés dans cet ordre, avec bascule automatique :

| Moteur | Quand il sert | Configuration |
| --- | --- | --- |
| Claude | Page publiée déclarant la capacité `sample` | aucune |
| Gemini | Application déployée ou lancée en local | clé embarquée dans `src/lib/ora.ts` |
| Analyse locale | Réseau injoignable | aucune, toujours disponible |

Chaque appel réseau porte un délai de garde de 20 secondes : un moteur qui ne répond pas
n'immobilise jamais la conversation. Sur saturation (HTTP 503/429), plusieurs modèles
Gemini sont essayés avec nouvelle tentative.

### Clé Gemini

La clé Google AI Studio se place dans un fichier `.env` à la racine, jamais dans le code :

```bash
cp .env.example .env
# puis, dans .env :
VITE_GEMINI_API_KEY=votre_clé_google_ai_studio
```

Au déploiement, définir la même variable dans l'hébergeur (Lovable, Vercel, Netlify…).
Vite l'incorpore au build, donc la clé finit lisible dans le JavaScript servi au
navigateur : **restreindre la clé par référent HTTP** dans la console Google AI Studio,
la limiter à la seule API Gemini, et la renouveler en cas de doute.

Ne pas l'écrire dans un fichier source : ce dépôt est public, et la protection contre
les secrets de GitHub refuse un tel commit. Pour une application traitant des données
réelles, l'appel à Gemini doit passer par un service serveur qui détient la clé, jamais
par le navigateur.

Sans clé, rien ne casse : Ora répond via Claude sur une page publiée, sinon via
l'analyse locale déterministe.

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
public/fonts/   Archivo & Archivo Black embarquées (hors ligne), repli Google Fonts
```
