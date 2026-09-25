import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useUser } from "../App";
import { ROLE_LABELS } from "../lib/auth";
import { formatClock } from "../lib/dates";
import { delaiDuDossier } from "../lib/delais";
import { TYPE_COURT, useDossiers } from "../lib/dossiers";
import { THEME_LABELS, useTheme, type Theme } from "../lib/theme";

function Horloge() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <time dateTime={now.toISOString()} className="hidden xl:block font-mono text-[12px] tabular-nums text-muted">
      {formatClock(now)}
    </time>
  );
}

const ICONE_THEME: Record<Theme, JSX.Element> = {
  clair: (
    <>
      <circle cx="9" cy="9" r="3.6" />
      <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.6 3.6l1.4 1.4M13 13l1.4 1.4M14.4 3.6L13 5M5 13l-1.4 1.4" />
    </>
  ),
  sombre: <path d="M14.5 11.2A6 6 0 0 1 6.8 3.5 6 6 0 1 0 14.5 11.2Z" />,
  systeme: (
    <>
      <rect x="2" y="3" width="14" height="9.5" />
      <path d="M6 15.5h6" />
    </>
  ),
};

/** Bascule du thème : clair, sombre, puis système. */
export function BoutonTheme() {
  const [theme, definir] = useTheme();
  const ordre: Theme[] = ["clair", "sombre", "systeme"];
  const suivant = ordre[(ordre.indexOf(theme) + 1) % ordre.length];
  return (
    <button
      type="button"
      className="btn-sm"
      onClick={() => definir(suivant)}
      title={`Thème : ${THEME_LABELS[theme]}. Cliquer pour ${THEME_LABELS[suivant].toLowerCase()}.`}
      aria-label={`Thème ${THEME_LABELS[theme]}, basculer vers ${THEME_LABELS[suivant]}`}
    >
      <svg viewBox="0 0 18 18" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        {ICONE_THEME[theme]}
      </svg>
      <span className="hidden lg:inline">{THEME_LABELS[theme]}</span>
    </button>
  );
}

/** Recherche transversale : saute au dossier, ou ouvre le registre filtré. */
function Recherche() {
  const dossiers = useDossiers();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef<HTMLDivElement>(null);

  const trouves = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    return dossiers
      .filter((d) => `${d.reference} ${d.demandeur} ${TYPE_COURT[d.type]}`.toLowerCase().includes(n))
      .slice(0, 6);
  }, [dossiers, q]);

  useEffect(() => {
    const dehors = (e: MouseEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, []);

  const aller = (id: string) => {
    setOuvert(false);
    setQ("");
    navigate(`/registre/${id}`);
  };

  return (
    <div ref={zone} className="relative flex-1 max-w-[420px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!q.trim()) return;
          setOuvert(false);
          navigate(`/registre?q=${encodeURIComponent(q.trim())}&analyste=__tous`);
        }}
      >
        <svg
          viewBox="0 0 18 18"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        >
          <circle cx="8" cy="8" r="5.2" />
          <path d="M12 12l4 4" />
        </svg>
        <input
          className="field pl-9"
          type="search"
          value={q}
          placeholder="Rechercher un dossier…"
          aria-label="Rechercher un dossier"
          onChange={(e) => {
            setQ(e.target.value);
            setOuvert(true);
          }}
          onFocus={() => setOuvert(true)}
        />
      </form>

      {ouvert && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 border border-line bg-card shadow-lg">
          {trouves.length === 0 ? (
            <p className="px-3 py-3 text-sm italic text-muted">Aucun dossier ne correspond.</p>
          ) : (
            <ul>
              {trouves.map((d) => {
                const c = delaiDuDossier(d);
                const clos = d.statut === "valide" || d.statut === "rejete";
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      className="flex w-full items-baseline gap-3 border-b border-hair px-3 py-2 text-left last:border-b-0 hover:bg-sand"
                      onClick={() => aller(d.id)}
                    >
                      <span className="font-mono text-[11px] text-muted">{d.reference}</span>
                      <span className="flex-1 truncate text-sm font-semibold">{d.demandeur}</span>
                      <span className={`text-xs tabular-nums ${!clos && c.delaiRestant <= 3 ? "text-rouge" : "text-muted"}`}>
                        {clos ? "clos" : `${c.delaiRestant} j`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Compteur d'alertes : ce qui appelle une action aujourd'hui. */
function Alertes() {
  const dossiers = useDossiers();
  const navigate = useNavigate();
  const { urgents, depasses } = useMemo(() => {
    const enCours = dossiers.filter((d) => d.statut === "en_instruction" || d.statut === "en_attente_pieces");
    const n = enCours.map((d) => delaiDuDossier(d).niveau);
    return { urgents: n.filter((x) => x === "urgent").length, depasses: n.filter((x) => x === "depasse").length };
  }, [dossiers]);

  if (!urgents && !depasses) return null;
  return (
    <button
      type="button"
      className="btn-sm border-rouge text-rouge hover:bg-rouge hover:text-sur-rouge hover:border-rouge"
      onClick={() => navigate(`/registre?analyste=__tous&niveau=${depasses ? "depasse" : "urgent"}`)}
      title={`${depasses} dossier(s) hors délai, ${urgents} urgent(s)`}
    >
      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rouge" aria-hidden="true" />
      {depasses > 0 ? `${depasses} hors délai` : `${urgents} urgent${urgents > 1 ? "s" : ""}`}
    </button>
  );
}

export default function BarreSuperieure({ onMenu }: { onMenu: () => void }) {
  const user = useUser();
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <button type="button" className="btn-sm lg:hidden" onClick={onMenu} aria-label="Ouvrir le menu">
          Menu
        </button>

        <Recherche />

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Alertes />
          <Horloge />
          <BoutonTheme />

          <div className="hidden items-baseline gap-2 border-l border-hair pl-3 sm:flex">
            <span className="text-sm font-bold leading-none">{user.displayName}</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">{ROLE_LABELS[user.role]}</span>
          </div>

          <button
            type="button"
            className="btn-sm"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            Quitter
          </button>
        </div>
      </div>
    </header>
  );
}
