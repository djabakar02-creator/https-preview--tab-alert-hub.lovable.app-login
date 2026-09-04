import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useUser } from "../App";
import BarreSuperieure from "./BarreSuperieure";
import OraFlottante from "./OraFlottante";

/** Pictogrammes de la navigation : traits simples, dans la ligne graphique du registre. */
const ICONES: Record<string, JSX.Element> = {
  bord: (
    <>
      <rect x="2" y="2" width="7" height="7" />
      <rect x="11" y="2" width="7" height="4" />
      <rect x="11" y="8" width="7" height="10" />
      <rect x="2" y="11" width="7" height="7" />
    </>
  ),
  registre: (
    <>
      <rect x="3" y="2" width="14" height="16" />
      <line x1="6" y1="6" x2="14" y2="6" />
      <line x1="6" y1="10" x2="14" y2="10" />
      <line x1="6" y1="14" x2="11" y2="14" />
    </>
  ),
  rapports: (
    <>
      <line x1="3" y1="17" x2="17" y2="17" />
      <rect x="4" y="10" width="3" height="7" />
      <rect x="9" y="5" width="3" height="12" />
      <rect x="14" y="8" width="3" height="9" />
    </>
  ),
  ora: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 3 A7 7 0 0 1 17 10" strokeWidth="2.4" />
    </>
  ),
  parametres: (
    <>
      <circle cx="10" cy="10" r="3" />
      <path d="M10 2v2.4M10 15.6V18M18 10h-2.4M4.4 10H2M15.5 4.5l-1.7 1.7M6.2 13.8l-1.7 1.7M15.5 15.5l-1.7-1.7M6.2 6.2 4.5 4.5" />
    </>
  ),
};

const LIENS = [
  { to: "/", label: "Tableau de bord", icone: "bord", end: true },
  { to: "/registre", label: "Registre", icone: "registre" },
  { to: "/rapports", label: "Rapports", icone: "rapports" },
  { to: "/ora", label: "Ora", icone: "ora" },
];

/* Réservé à l'administrateur : sécurité, comptes, circuits et délais. */
const LIEN_PARAMETRES = { to: "/parametres", label: "Paramètres", icone: "parametres", end: false };

export default function Layout() {
  const user = useUser();
  const [ouvert, setOuvert] = useState(false);
  const liens = user.role === "admin" ? [...LIENS, LIEN_PARAMETRES] : LIENS;

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[240px_1fr]">
      {/* Colonne latérale */}
      <aside className="flex flex-col border-b border-line bg-card lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="border-t-4 border-t-rouge px-5 pb-5 pt-5">
          <p className="text-[9px] font-bold uppercase leading-snug tracking-[0.16em] text-muted">
            BEAC · Direction de la
            <br />
            Réglementation des Changes
          </p>
          <p className="mt-2.5 font-display text-[21px] leading-none">
            BEAC‑DRC
            <span className="mt-1 block text-[14px] text-rouge">Autorisations</span>
          </p>
        </div>

        <nav
          className={`${ouvert ? "block" : "hidden"} flex-1 border-t border-hair py-2 lg:block`}
          aria-label="Navigation principale"
        >
          {liens.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setOuvert(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 border-l-[3px] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] transition-colors ${
                  isActive ? "border-l-rouge bg-sand text-rouge" : "border-l-transparent text-ink hover:bg-sand/60"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <svg
                    viewBox="0 0 20 20"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                    className={isActive ? "" : "text-muted"}
                  >
                    {ICONES[l.icone]}
                  </svg>
                  {l.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <p className="hidden border-t border-hair px-5 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-muted lg:block">
          Service des Autorisations
        </p>
      </aside>

      {/* Contenu */}
      <div className="flex min-w-0 flex-col">
        <BarreSuperieure onMenu={() => setOuvert((o) => !o)} />
        <main className="w-full flex-1 px-4 py-7 lg:px-8">
          <Outlet />
        </main>
        <OraFlottante />
        <footer className="border-t border-line px-4 py-3 lg:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            Usage réservé · Registre officiel des dossiers d'autorisation de change
          </p>
        </footer>
      </div>
    </div>
  );
}
