import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { saveSession, seDeconnecter, sessionCourante, type User } from "./lib/auth";
import { initialiserRegistre, rafraichirRegistre } from "./lib/dossiers";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Registre from "./pages/Registre";
import Rapports from "./pages/Rapports";
import Ora from "./pages/Ora";

interface AuthCtx {
  user: User | null;
  login: (u: User) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth hors AuthProvider");
  return c;
}

/** Variante pour les pages protégées : l'utilisateur est garanti non nul. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("Page protégée sans utilisateur");
  return user;
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [pret, setPret] = useState(false);

  /* Une session peut déjà être ouverte : cookie du serveur, ou session locale. */
  useEffect(() => {
    let vivant = true;
    void (async () => {
      const u = await sessionCourante().catch(() => null);
      await initialiserRegistre(Boolean(u)).catch(() => {});
      if (!vivant) return;
      setUser(u);
      setPret(true);
    })();
    return () => {
      vivant = false;
    };
  }, []);

  const login = useCallback((u: User) => {
    saveSession(u);
    setUser(u);
    void rafraichirRegistre().catch(() => {});
  }, []);
  const logout = useCallback(() => {
    void seDeconnecter();
    setUser(null);
  }, []);
  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

  if (!pret) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="label-caps text-muted">Chargement du registre…</p>
      </div>
    );
  }

  return (
    <Ctx.Provider value={value}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="registre" element={<Registre />} />
          <Route path="registre/:id" element={<Registre />} />
          <Route path="rapports" element={<Rapports />} />
          <Route path="ora" element={<Ora />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Ctx.Provider>
  );
}
