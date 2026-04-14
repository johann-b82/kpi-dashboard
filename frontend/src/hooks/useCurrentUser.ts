import { useQuery } from "@tanstack/react-query";

export type CurrentUser = {
  sub: string;
  email: string;
  name: string | null;
};

export function useCurrentUser() {
  return useQuery<CurrentUser>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) throw new Error("unauthenticated");
      if (!res.ok) throw new Error(`auth/me failed: ${res.status}`);
      return (await res.json()) as CurrentUser;
    },
    retry: false, // D-22: no retry loop on 401
    staleTime: Infinity, // D-22: identity stable within session
    gcTime: Infinity,
  });
}
