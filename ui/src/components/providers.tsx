"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useStableQuery } from "./use-stable-query";
import { api } from "../../convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const SelfContext = createContext<{
  self: Awaited<
    ReturnType<typeof useStableQuery<typeof api.tasks.getSelf>>
  > | null;
}>({
  self: null,
});

export function useSelf() {
  return useContext(SelfContext);
}

export function SelfProvider({ children }: { children: React.ReactNode }) {
  const self = useStableQuery(api.tasks.getSelf);
  return (
    <SelfContext.Provider value={{ self }}>{children}</SelfContext.Provider>
  );
}

function useAuthFromProviderMicrosoft() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    async function loadSession() {
      try {
        const res = await fetch("/api/auth/microsoft/session", {
          method: "GET",
          cache: "no-store",
        });
        if (!cancelled) {
          const data = (await res.json()) as { authenticated?: boolean };
          setIsAuthenticated(Boolean(res.ok && data.authenticated));
        }
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    return {
      isLoading,
      isAuthenticated,
      fetchAccessToken: async ({
        forceRefreshToken,
      }: {
        forceRefreshToken: boolean;
      }) => {
        if (typeof window === "undefined") {
          return null;
        }
        const res = await fetch("/api/convex/token", {
          method: "GET",
          cache: forceRefreshToken ? "no-store" : "default",
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { token?: string };
        return data.token ?? null;
      },
    };
  }, [isAuthenticated, isLoading]);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // useEffect(() => {
  //   try {
  //     const initDataRaw = retrieveRawInitData();

  //     // The 'user' parameter is a JSON string of the WebAppUser object

  //     if (initDataRaw) {
  //       const params = new URLSearchParams(initDataRaw);
  //       const userJson = params.get("user");
  //       if (typeof userJson === "string") {
  //         const user = JSON.parse(userJson);
  //         const userId = user.id;
  //         const userName = user.username;
  //         posthog.identify(userId, {
  //           username: userName,
  //         });
  //       }
  //     }
  //     posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
  //       // api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
  //       api_host: "/relay-AQvm",
  //       ui_host: env.NEXT_PUBLIC_POSTHOG_HOST,
  //       // person_profiles:
  //       // person_profiles: "always", // or 'always' to create profiles for anonymous users as well
  //       defaults: "2025-11-30",
  //     });
  //   } catch (error) {
  //     console.error(error);
  //   }
  // }, []);

  return (
    <ConvexProviderWithAuth
      client={convex}
      useAuth={useAuthFromProviderMicrosoft}
    >
      <QueryClientProvider client={queryClient}>
        {/* <SelfProvider>{children}</SelfProvider> */}
        {children}
      </QueryClientProvider>
    </ConvexProviderWithAuth>
  );
}
