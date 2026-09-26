import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { LoginPayload, SessionUser } from "../lib/types";

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "personnel.session.token";
const USER_KEY = "personnel.session.user";

function readStoredUser(): SessionUser | null {
  try {
    const value = sessionStorage.getItem(USER_KEY);
    return value ? (JSON.parse(value) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => sessionStorage.getItem(TOKEN_KEY) ? readStoredUser() : null);
  const [loading, setLoading] = useState(() => Boolean(sessionStorage.getItem(TOKEN_KEY)));

  const signOut = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const expire = () => signOut();
    window.addEventListener("personnel:session-expired", expire);
    return () => window.removeEventListener("personnel:session-expired", expire);
  }, [signOut]);

  useEffect(() => {
    if (!sessionStorage.getItem(TOKEN_KEY)) return;
    let active = true;
    api.get<{ user: SessionUser }>("/auth/me")
      .then(({ user: current }) => {
        if (!active) return;
        const restored = { ...readStoredUser(), ...current } as SessionUser;
        sessionStorage.setItem(USER_KEY, JSON.stringify(restored));
        setUser(restored);
      })
      .catch(() => {
        if (active) signOut();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [signOut]);

  const signIn = useCallback(async (username: string, password: string) => {
    const result = await api.post<LoginPayload>("/auth/login", { username, password });
    sessionStorage.setItem(TOKEN_KEY, result.token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setUser(result.user);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signIn,
    signOut,
    can: (permission) => Boolean(user?.permissions.includes(permission)),
  }), [user, loading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
