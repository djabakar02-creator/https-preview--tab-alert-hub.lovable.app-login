import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { DEMO_ACCOUNTS, seConnecter } from "../lib/auth";
import { formatEdition, formatLongDateFR } from "../lib/dates";
import { BoutonTheme } from "../components/BarreSuperieure";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const today = new Date();

  const [enCours, setEnCours] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (enCours) return;
    setEnCours(true);
    try {
      const user = await seConnecter(identifiant, motDePasse);
      if (!user) {
        setErreur("Identifiant ou mot de passe incorrect.");
        return;
      }
      setErreur(null);
      login(user);
      navigate("/", { replace: true });
    } catch {
      setErreur("Le service est injoignable. Réessayez dans un instant.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <main className="min-h-screen bg-card flex items-center justify-center p-6">
      <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-[1fr_422px] border border-line shadow-[0_0_0_1px_rgba(0,0,0,0.02)]">
        {/* Panneau éditorial */}
        <section className="bg-paper border-t-[5px] border-t-rouge flex flex-col">
          <header className="flex items-start justify-between px-8 pt-9 pb-8 border-b border-line">
            <div>
              <p className="label-caps mb-2">BEAC · Direction de la Réglementation des Changes</p>
              <h1 className="font-display text-[44px] leading-none tracking-tight">BEAC‑DRC</h1>
            </div>
            <div className="text-right">
              <p className="label-caps">Édition</p>
              <p className="text-[15px] font-bold mt-0.5">Nº {formatEdition(today)}</p>
            </div>
          </header>

          <div className="px-12 pt-12 pb-10 flex-1">
            <p className="label-caps text-rouge mb-7">Volume XXVI · {today.getFullYear()}</p>
            <h2 className="font-display leading-[0.92] tracking-[-0.02em] text-[64px] sm:text-[76px]">
              Suivi
              <br />
              des dossiers
              <br />
              <span className="text-rouge">Autorisations</span>
            </h2>
            <hr className="border-0 border-t-2 border-line mt-9 mb-8 w-full max-w-[450px]" />
            <p className="max-w-[420px] text-[15px] leading-relaxed">
              Registre officiel des dossiers d'autorisation de change. Tenue rigoureuse, lecture immédiate, traçabilité
              complète.
            </p>
          </div>

          <footer className="flex items-center justify-between gap-3 px-8 py-2.5 border-t border-line">
            <p className="label-caps">{formatLongDateFR(today)}</p>
            <div className="flex items-center gap-4">
              <p className="label-caps hidden sm:block">Usage réservé</p>
              <BoutonTheme />
            </div>
          </footer>
        </section>

        {/* Panneau connexion */}
        <section className="flex flex-col border-t border-line lg:border-t-0 lg:border-l border-l-line">
          <div className="bg-fort text-sur-fort px-8 pt-8 pb-9">
            <p className="label-caps mb-4">Accès registre</p>
            <h2 className="font-display text-[28px] leading-none tracking-tight uppercase">Connexion</h2>
          </div>

          <form onSubmit={onSubmit} className="bg-paper px-8 pt-8 pb-10 flex-1" noValidate>
            <label className="block mb-7">
              <span className="label-caps block mb-2">Identifiant</span>
              <input
                className="input-line"
                autoComplete="username"
                autoFocus
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                aria-label="Identifiant"
              />
            </label>
            <label className="block mb-8">
              <span className="label-caps block mb-2">Mot de passe</span>
              <input
                className="input-line"
                type="password"
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                aria-label="Mot de passe"
              />
            </label>
            {erreur && (
              <p role="alert" className="text-rouge text-sm font-semibold mb-4">
                {erreur}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={enCours}>
              {enCours ? "Vérification…" : "Entrer dans le registre"}
            </button>
          </form>

          <div className="bg-sand border-t border-line px-8 pt-6 pb-7">
            <p className="label-caps mb-4">Comptes de démonstration</p>
            <ul className="space-y-1.5 text-[12px]">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.username} className="flex justify-between">
                  <button
                    type="button"
                    className="hover:underline text-left"
                    onClick={() => {
                      setIdentifiant(a.username);
                      setMotDePasse(a.password);
                      setErreur(null);
                    }}
                  >
                    {a.username}
                  </button>
                  <span className="font-bold">
                    {a.username} / {a.password}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
