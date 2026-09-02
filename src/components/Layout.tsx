import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, useUser } from "../App";
import { ROLE_LABELS } from "../lib/auth";
import { formatClock } from "../lib/dates";

function Horloge() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <time dateTime={now.toISOString()} className="font-mono text-[13px] tabular-nums" aria-live="off">
      {formatClock(now)}
    </time>
  );
}

const LIENS = [
  { to: "/", label: "Tableau de bord", end: true },
  { to: "/registre", label: "Registre" },
  { to: "/rapports", label: "Rapports" },
  { to: "/ora", label: "Ora" },
];

export default function Layout() {
  const user = useUser();
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-line bg-paper">
        <div className="border-t-[5px] border-t-rouge">
          <div className="max-w-[1400px] mx-auto px-6 py-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="mr-auto">
              <p className="label-caps">BEAC · Direction de la Réglementation des Changes</p>
              <p className="font-display text-2xl leading-none mt-1">
                BEAC‑DRC <span className="text-rouge">· Autorisations</span>
              </p>
            </div>
            <Horloge />
            <div className="text-right text-sm">
              <p className="font-bold">{user.displayName}</p>
              <p className="label-caps text-[10px] opacity-70">{ROLE_LABELS[user.role]}</p>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              Déconnexion
            </button>
          </div>
        </div>
        <nav className="max-w-[1400px] mx-auto px-6 flex gap-1 overflow-x-auto" aria-label="Navigation principale">
          {LIENS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `label-caps px-4 py-3 border-b-[3px] -mb-px whitespace-nowrap transition ${
                  isActive ? "border-rouge text-rouge" : "border-transparent hover:border-ink"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-line">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex justify-between">
          <p className="label-caps">Service des Autorisations</p>
          <p className="label-caps">Usage réservé</p>
        </div>
      </footer>
    </div>
  );
}
