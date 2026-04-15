import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { directus } from "@/lib/directusClient";
import {
  apiClient,
  setAccessToken,
  setAuthFailureHandler,
  trySilentRefresh,
} from "@/lib/apiClient";

export type Role = "admin" | "viewer";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthState {
  user: AuthUser | null;
  role: Role | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

interface MeResponse {
  id: string;
  email: string;
  role: Role;
}

/**
 * AuthProvider — owns user/role/isLoading React state. The short-lived access
 * token does NOT live in React state; it sits in apiClient.ts's module
 * singleton to avoid re-rendering every consumer on every refresh.
 *
 * On mount: attempt a silent refresh (uses the httpOnly Directus refresh
 * cookie set on a prior login). If it succeeds, hydrate the user via
 * GET /api/me. If it fails, we land unauthenticated and <AuthGate> redirects
 * to /login.
 *
 * signIn / signOut delegate to the Directus SDK, then sync the module-singleton
 * token and React state. signOut also clears the React Query cache so a new
 * user doesn't see the previous user's data. Per D-07 the local state is
 * cleared even if directus.logout() throws (network down / expired session).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // StrictMode runs effects twice in dev. Guard the initial hydration so we
  // don't double-fire directus.refresh() and race the refresh-token rotation.
  const hydratedRef = useRef(false);

  // Clears auth state locally. Used by signOut() and the 401-refresh-failure
  // path (via setAuthFailureHandler below).
  const clearLocalAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  // Register the apiClient auth-failure callback. This fires when a 401
  // survives a silent refresh attempt — AuthGate will then redirect to /login
  // because user becomes null.
  useEffect(() => {
    setAuthFailureHandler(() => {
      clearLocalAuth();
    });
    return () => setAuthFailureHandler(null);
  }, [clearLocalAuth]);

  // Initial hydration.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const refreshed = await trySilentRefresh();
        if (!refreshed) {
          if (!cancelled) setUser(null);
          return;
        }
        const me = await apiClient<MeResponse>("/api/me");
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      // Throws on bad credentials — LoginPage catches to show inline error.
      await directus.login({ email, password });
      const token = await directus.getToken();
      setAccessToken(token ?? null);
      const me = await apiClient<MeResponse>("/api/me");
      setUser(me);
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await directus.logout();
    } catch {
      // D-07: Network failure must still clear local auth state.
    }
    clearLocalAuth();
  }, [clearLocalAuth]);

  const value: AuthState = {
    user,
    role: user?.role ?? null,
    isLoading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
