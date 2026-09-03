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

## Rapports et exports

La synthèse couvre les niveaux de délai, les statuts, le détail par type
d'opération, la charge par analyste, les montants par devise et les réceptions
des douze derniers mois, avec délai moyen, médian, taux de respect des échéances
et complétude des pièces.

Le calcul vit dans `src/lib/rapport.ts`, sans état ni rendu : l'écran, le PDF et
le classeur s'appuient tous les trois dessus, donc le document téléchargé dit
exactement ce que l'écran affiche.

| Format | Contenu |
| --- | --- |
| **PDF** | Synthèse mise en page à l'identité du registre, puis le registre détaillé. Ligne hors délai en rouge, pied de page numéroté, aucun tableau coupé entre deux pages. |
| **XLSX** | Deux feuilles : *Synthèse* et *Registre*. En-têtes figés, filtre automatique, dates et montants au bon format, niveaux de délai teintés. Mise en page prête à l'impression : paysage ajusté à la largeur, ligne d'en-tête répétée. |
| **CSV** | Aller-retour fidèle avec l'import tableur, pièces et observations comprises. |

Les bibliothèques d'export sont chargées à la demande : elles ne pèsent sur le
temps d'ouverture d'aucune autre page.

## Filtre par type d'opération

Le registre et les rapports partagent un même sélecteur : plusieurs types se
cumulent, aucune sélection valant « tous les types ». Le choix est porté par
l'URL (`?types=transfert,emprunt`), donc il survit à un rechargement et se
partage par lien.

## Ora, assistante d'instruction

Ora est le volet conversationnel de l'application. Sa persona, ses compétences et ses
règles de conduite sont définies dans `src/lib/ora.ts` : cadre CEMAC (Règlement
n° 02/18/CEMAC/UMAC/CM), qualification des demandes, contrôle de complétude, suivi des
délais, aide à la décision.

Deux garde-fous sont inscrits dans ses instructions :

- elle reprend le délai restant **calculé par le registre** et ne le recalcule jamais ;
- elle n'invente **aucun** numéro d'article, seuil ou délai réglementaire ; si une
  disposition lui manque, elle le dit au lieu de la supposer.

**Quatre moteurs**, essayés dans cet ordre, avec bascule automatique :

| Moteur | Quand il sert | Configuration |
| --- | --- | --- |
| Claude | Page publiée déclarant la capacité `sample` | aucune |
| Service BEAC | Déploiement normal : `server/index.mjs` détient la clé | `ORA_API_KEY` côté serveur |
| Gemini direct | Développement seulement | `VITE_GEMINI_API_KEY` |
| Analyse locale | Aucun moteur joignable | aucune, toujours disponible |

Chaque appel réseau porte un délai de garde de 20 secondes : un moteur qui ne répond pas
n'immobilise jamais la conversation. Sur saturation (HTTP 503/429), plusieurs modèles
Gemini sont essayés avec nouvelle tentative.

### Le service Ora : la clé ne quitte pas le serveur

Une application web sert son code au navigateur. Toute variable `VITE_*` finit donc
lisible par n'importe quel visiteur, quelle que soit la restriction posée sur la clé.
`server/index.mjs` répond à ce problème : il détient la clé, expose `POST /api/ora`,
et le navigateur ne voit jamais que des questions et des réponses.

```bash
cp .env.example .env      # renseigner ORA_API_KEY (sans préfixe VITE_)
npm run build
npm run service           # sert dist/ et /api/ora sur le port 8787
```

En développement, lancer les deux : `npm run service` d'un côté, `npm run dev` de
l'autre. Vite relaie `/api` vers le service.

Ce que le service garantit, et que le test `server/ora.test.mjs` couvre :

- la consigne système et le nom du modèle viennent du serveur — le navigateur ne peut
  imposer ni l'un ni l'autre, et un tour de rôle `system` envoyé par le client est refusé ;
- le corps d'erreur du fournisseur n'est jamais relayé, car il peut contenir la clé ;
- la conversation est bornée en nombre de tours et en volume ;
- vingt requêtes par minute et par adresse au maximum.

## Application de bureau (Windows, macOS, Linux)

L'application s'installe aussi comme un logiciel de poste, sans navigateur ni
serveur à administrer. Le processus principal démarre le service Ora sur un port
libre de la boucle locale, puis ouvre la fenêtre dessus.

```bash
npm run desktop           # lancer depuis les sources
npm run dist:win          # Windows : installateur .exe + archive portable
npm run dist:win-portable # Windows : archive portable seule
npm run dist:linux        # AppImage
npm run dist:mac          # dmg
```

L'installateur `.exe` repose sur NSIS, qui doit s'exécuter sous Windows : lancer
`npm run dist:win` depuis un poste Windows, ou une machine de construction
Windows. Depuis Linux ou macOS, `npm run dist:win-portable` produit une archive
que l'on décompresse et lance directement, sans installation ni droits
d'administrateur.

Un installateur destiné à des postes d'une administration doit être **signé**.
Sans signature, Windows SmartScreen affiche un avertissement à chaque
installation. La signature demande un certificat d'éditeur, à demander au
service informatique.

### Configurer Ora sur le poste

Menu **Fichier › Configurer Ora…** ouvre `ora.json`, dans le dossier de
configuration de l'utilisateur. La clé y reste : elle n'est jamais transmise à
la fenêtre.

```json
{ "fournisseur": "openai", "cle": "…", "modele": "llama3.1", "base": "http://localhost:11434/v1" }
```

Avec Ollama installé sur le poste, **aucune donnée ne sort de la machine**.

> **Un registre par poste.** En application de bureau, les dossiers sont
> enregistrés sur le poste, dans le profil de l'utilisateur. Deux agents
> installant le logiciel travaillent sur deux registres distincts, sans rien
> partager. C'est adapté à un usage individuel ou à une démonstration, mais pas
> à un service dont plusieurs agents instruisent les mêmes dossiers : pour cela,
> déployer le service sur une machine du réseau interne et y accéder par
> navigateur.

### Changer de fournisseur

`ORA_FOURNISSEUR=openai` avec `ORA_BASE_URL` suffit pour n'importe quelle API
compatible OpenAI, sans toucher au code :

| Fournisseur | `ORA_BASE_URL` | `ORA_MODELE` |
| --- | --- | --- |
| Google AI Studio | (laisser vide, `ORA_FOURNISSEUR=gemini`) | `gemini-flash-latest` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Cerebras | `https://api.cerebras.ai/v1` | `gpt-oss-120b` |
| Mistral | `https://api.mistral.ai/v1` | `mistral-large-latest` |
| Ollama (local) | `http://localhost:11434/v1` | `llama3.1` |

Sans clé, rien ne casse : Ora répond via Claude sur une page publiée, sinon via
l'analyse locale déterministe.

## Déploiement en service partagé (formule recommandée)

Les agents accèdent au registre par navigateur ; les dossiers vivent sur le
serveur, pas dans chaque poste.

```bash
npm run build
ORA_SECRET=$(openssl rand -hex 32) \
ORA_API_KEY=votre_clé \
ORA_DONNEES=/var/lib/beac-drc/registre.json \
PORT=8787 npm run service
```

| Variable | Rôle |
| --- | --- |
| `ORA_SECRET` | Signe les cookies de session. **Obligatoire** : sans elle, toutes les sessions tombent à chaque redémarrage. |
| `ORA_DONNEES` | Fichier du registre partagé. À sauvegarder comme une base de données. |
| `ORA_COOKIE_SECURISE=1` | À poser dès que le service est derrière HTTPS. |

Le registre est un fichier JSON écrit de façon atomique, ce qui suffit au volume
d'un service et évite d'imposer une base de données. Chaque navigateur relit le
registre toutes les quinze secondes et au retour sur l'onglet : un agent voit
donc les décisions de la hiérarchie sans recharger la page.

### Ce que le service refuse, quoi qu'affiche l'interface

Masquer un bouton ne protège rien : une requête peut toujours être forgée. Les
permissions sont donc vérifiées à l'écriture, côté serveur, et le test
`server/registre.test.mjs` les couvre :

- un analyste ne peut ni modifier, ni supprimer le dossier d'un autre ;
- un analyste ne peut pas valider un dossier, même le sien ;
- la hiérarchie valide et réattribue, mais ne modifie pas le fond ;
- le profil lecture n'écrit rien ;
- seul l'administrateur importe ou réinitialise le registre ;
- deux agents modifiant le même dossier ne s'écrasent pas : la seconde écriture
  est refusée avec une invitation à recharger.

Les mots de passe ne sont pas stockés en clair : seul un condensat scrypt est
conservé, et la session tient dans un cookie signé, `HttpOnly` et `SameSite`.

> **Avant tout usage réel.** Les comptes de démonstration sont créés au
> démarrage dans `server/comptes.mjs`. Les remplacer par l'annuaire de la Banque
> (LDAP, Active Directory) : le reste du service n'en dépend pas, il lui suffit
> d'un objet `{ username, role }`.

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
