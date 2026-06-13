import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { ApiClient } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { LoginPage } from "@/pages/login"
import { SetupPage } from "@/pages/setup"
import { createAppRouter } from "@/router"

export default function App() {
  const { session } = useAuth()
  // A fresh router per session keeps no stale matches across sign-ins.
  const router = useMemo(() => (session ? createAppRouter() : null), [session])

  // When unauthenticated, probe the same-origin server for first-run state so a
  // fresh install lands on the setup screen instead of a login it can't pass.
  // Failures (older servers, remote URLs) fall through to the login page.
  const setup = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => new ApiClient({ baseUrl: "", apiKey: "" }).setupStatus(),
    enabled: !session,
    retry: false,
    staleTime: Infinity,
  })

  if (session && router) return <RouterProvider router={router} />
  if (setup.data?.needs_setup) return <SetupPage baseUrl="" />
  return <LoginPage />
}
