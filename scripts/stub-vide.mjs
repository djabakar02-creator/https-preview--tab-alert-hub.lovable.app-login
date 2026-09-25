/* Stub vide pour les dépendances optionnelles de jsPDF (html2canvas, canvg,
   dompurify, core-js) que l'app n'utilise jamais : elle n'appelle jamais
   doc.html() ni les méthodes SVG de jsPDF (voir export-documents.ts, aucune
   occurrence de ".html(" ni de ces noms). En build fichier unique, Rollup
   inline tous les import() dynamiques (inlineDynamicImports) — sans cet
   alias, il embarquerait quand même le code mort de ces bibliothèques,
   dont la table Unicode de découpage de lignes d'html2canvas, qui a fait
   échouer la publication de l'artefact (faux positif du classifieur de
   pages de revue de PR sur ces octets, alors qu'ils ne sont jamais exécutés). */
export default undefined;
