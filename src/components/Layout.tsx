import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, useUser } from "../App";
import { ROLE_LABELS } from "../lib/auth";
import { formatClock } from "../lib/dates";

function Horloge({ compact }: { compact?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <time dateTime={now.toISOString()} className={`font-mono tabular-nums ${compact ? "text-[12px]" : "text-[13px]"}`} aria-live="off">
      {formatClock(now)}
    </time>
  );
}

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
};

const LIENS = [
  { to: "/", label: "Tableau de bord", icone: "bord", end: true },
  { to: "/registre", label: "Registre", icone: "registre" },
  { to: "/rapports", label: "Rapports", icone: "rapports" },
  { to: "/ora", label: "Ora", icone: "ora" },
];

function Nav({ onNavigue }: { onNavigue?: () => void }) {
  return (
    <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible" aria-label="Navigation principale">
      {LIENS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          onClick={onNavigue}
          className={({ isActive }) =>
            `label-caps flex items-center gap-3 px-3 py-3 whitespace-nowrap border-l-[3px] transition ${
              isActive ? "border-l-rouge text-rouge bg-white/60" : "border-l-transparent hover:border-l-ink hover:bg-white/40"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <svg
                viewBox="0 0 20 20"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
                className={isActive ? "" : "opacity-70"}
              >
                {ICONES[l.icone]}
              </svg>
              {l.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const user = useUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [ouvert, setOuvert] = useState(false);

  const deconnexion = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[248px_1fr]">
      {/* Colonne latérale */}
      <aside className="bg-paper border-r border-line flex flex-col lg:sticky lg:top-0 lg:h-screen">
        <div className="border-t-[5px] border-t-rouge px-5 pt-5 pb-4 border-b border-line flex items-start justify-between gap-3">
          <div>
            <p className="label-caps text-[9px] leading-snug opacity-80">
              BEAC · Direction de la
              <br />
              Réglementation des Changes
            </p>
            <p className="font-display text-[22px] leading-none mt-2">
              BEAC‑DRC
              <span className="block text-rouge text-[15px] mt-1">Autorisations</span>
            </p>
          </div>
          <button
            type="button"
            className="btn-sm lg:hidden shrink-0"
            aria-expanded={ouvert}
            onClick={() => setOuvert((o) => !o)}
          >
            {ouvert ? "Fermer" : "Menu"}
          </button>
        </div>

        <div className={`${ouvert ? "block" : "hidden"} lg:block flex-1 py-3`}>
          <Nav onNavigue={() => setOuvert(false)} />
        </div>

        <div className={`${ouvert ? "block" : "hidden"} lg:block border-t border-line px-5 py-4`}>
          <p className="font-bold text-sm leading-tight">{user.displayName}</p>
          <p className="label-caps text-[9px] opacity-70 mt-0.5">{ROLE_LABELS[user.role]}</p>
          <div className="mt-3">
            <Horloge compact />
          </div>
          <button type="button" className="btn-ghost w-full mt-3 text-[10px] py-2" onClick={deconnexion}>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Contenu */}
      <div className="flex flex-col min-w-0">
        <main className="flex-1 w-full px-6 lg:px-10 py-8">
          <Outlet />
        </main>
        <footer className="border-t border-line">
          <div className="px-6 lg:px-10 py-3 flex justify-between">
            <p className="label-caps">Service des Autorisations</p>
            <p className="label-caps">Usage réservé</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
