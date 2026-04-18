import { useEffect } from "react";
import type { ReactNode } from "react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { AuthSplash } from "./AuthSplash";

/**
 * Gates children on /api/auth/me. On 401 (isError) redirects to
 * /api/auth/login via window.location.href per D-21 (no intermediate
 * sign-in screen). While pending or during redirect, renders <AuthSplash/>
 * to prevent white-flash or partial-UI per D-20.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data: user, isPending, isError } = useCurrentUser();

  useEffect(() => {
    if (isError) {
      // D-21: no intermediate sign-in screen — go straight to Dex.
      window.location.href = "/api/auth/login";
    }
  }, [isError]);

  if (isPending || isError || !user) return <AuthSplash />; // D-20
  return <>{children}</>;
}
