import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { initialiserTheme } from "./lib/theme";

/* Le thème est posé avant le premier rendu : pas de bascule visible au chargement. */
initialiserTheme();

/* VITE_ROUTER=hash pour un hébergement statique sans réécriture d'URL
   (fichier unique, GitHub Pages, partage de recette). */
const Router = import.meta.env.VITE_ROUTER === "hash" ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
);
