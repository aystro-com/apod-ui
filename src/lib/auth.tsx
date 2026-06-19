/* eslint-disable react-refresh/only-export-components -- context + hooks live together by design */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { ApiClient, ApiError } from "@/lib/api"

const STORAGE_KEY = "apod.connection"

export type Credentials =
  | { kind: "key"; apiKey: string }
  | { kind: "password"; name: string; password: string; code?: string }

/** True when the server accepted the password but needs a 2FA code. */
export function isTwoFactorRequired(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 401 &&
    err.message.includes("2fa_required")
  )
}

export interface Session {
  baseUrl: string
  /** Bearer credential: an API key or an apod_sess_ session token. */
  token: string
  kind: "key" | "session"
  role: "admin" | "user"
  name?: string
  /** May this identity provision sites? Always true for admins. */
  canCreateSites: boolean
}

function loadStored(): Session | null {
  // sessionStorage first (per-tab), then localStorage ("remember this device").
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(STORAGE_KEY)
      if (!raw) continue
      const parsed = JSON.parse(raw) as Session & { apiKey?: string }
      // Migrate sessions stored by older UI versions ({ apiKey } shape).
      if (!parsed.token && parsed.apiKey) {
        const role = parsed.role === "user" ? "user" : "admin"
        return {
          baseUrl: parsed.baseUrl ?? "",
          token: parsed.apiKey,
          kind: "key",
          role,
          canCreateSites: role === "admin",
        }
      }
      if (parsed.token && typeof parsed.baseUrl === "string") {
        // Default missing capability (older stored sessions) from the role.
        return {
          ...parsed,
          canCreateSites: parsed.canCreateSites ?? parsed.role === "admin",
        }
      }
    } catch {
      /* ignore corrupt/unavailable storage */
    }
  }
  return null
}

function clearStored() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

interface AuthContextValue {
  session: Session | null
  api: ApiClient | null
  connect: (
    baseUrl: string,
    credentials: Credentials,
    remember: boolean,
  ) => Promise<void>
  disconnect: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadStored())

  const disconnect = useCallback(() => {
    const current = session ?? loadStored()
    clearStored()
    setSession(null)
    // Best-effort server-side revocation for password sessions.
    if (current?.kind === "session") {
      new ApiClient({ baseUrl: current.baseUrl, apiKey: current.token })
        .logout()
        .catch(() => {})
    }
  }, [session])

  const connect = useCallback(
    async (baseUrl: string, credentials: Credentials, remember: boolean) => {
      const normalized = baseUrl.trim().replace(/\/+$/, "")
      if (normalized && !/^https?:\/\//i.test(normalized)) {
        throw new Error("Server URL must start with http:// or https://")
      }

      let next: Session
      if (credentials.kind === "password") {
        const probe = new ApiClient({ baseUrl: normalized, apiKey: "" })
        const res = await probe.login(
          credentials.name,
          credentials.password,
          credentials.code,
        )
        next = {
          baseUrl: normalized,
          token: res.token,
          kind: "session",
          role: res.user.role === "admin" ? "admin" : "user",
          name: res.user.name,
          canCreateSites:
            res.user.role === "admin" || !!res.user.can_create_sites,
        }
      } else {
        const probe = new ApiClient({
          baseUrl: normalized,
          apiKey: credentials.apiKey,
        })
        // Validate the key against an endpoint every role can reach.
        await probe.listSites()
        // Identity via /auth/me; older servers without it get the legacy
        // admin-endpoint probe instead.
        let role: "admin" | "user" = "admin"
        let name: string | undefined
        let canCreate = true
        try {
          const identity = await probe.me()
          role = identity.role === "admin" ? "admin" : "user"
          name = identity.name
          canCreate = role === "admin" || !!identity.can_create_sites
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) throw err
          try {
            await probe.serverStats()
          } catch (probeErr) {
            if (probeErr instanceof ApiError && probeErr.status === 403) {
              role = "user"
              // Older server without /auth/me: assume no create permission for
              // non-admins; an admin can grant it and they'll re-login.
              canCreate = false
            } else if (probeErr instanceof ApiError && probeErr.status === 401) {
              throw probeErr
            }
            // Any other failure: keep admin and let pages surface errors.
          }
        }
        next = {
          baseUrl: normalized,
          token: credentials.apiKey,
          kind: "key",
          role,
          name,
          canCreateSites: canCreate,
        }
      }

      try {
        const store = remember ? localStorage : sessionStorage
        store.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* storage unavailable — stay in-memory */
      }
      setSession(next)
    },
    [],
  )

  const api = useMemo(() => {
    if (!session) return null
    return new ApiClient({
      baseUrl: session.baseUrl,
      apiKey: session.token,
      onUnauthorized: () => {
        clearStored()
        setSession(null)
      },
    })
  }, [session])

  const value = useMemo(
    () => ({ session, api, connect, disconnect }),
    [session, api, connect, disconnect],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

// For routes that are only rendered when authenticated.
export function useApi(): { api: ApiClient; session: Session } {
  const { api, session } = useAuth()
  if (!api || !session) throw new Error("Not authenticated")
  return { api, session }
}
