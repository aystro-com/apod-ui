import { useState, type FormEvent } from "react"
import { RocketIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { ApiClient } from "@/lib/api"
import { useAuth } from "@/lib/auth"

const MIN_PASSWORD_LENGTH = 8
const USERNAME_RE = /^[a-z][a-z0-9-]{2,31}$/

/**
 * First-run screen: create the initial admin account, then sign in. Shown when
 * GET /setup/status reports the instance has no users.
 */
export function SetupPage({ baseUrl }: { baseUrl: string }) {
  const { connect } = useAuth()
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    const n = name.trim().toLowerCase()
    if (!USERNAME_RE.test(n)) {
      setError(
        "Username must be 3–32 lowercase letters, digits, or hyphens, starting with a letter.",
      )
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    setBusy(true)
    try {
      const client = new ApiClient({ baseUrl, apiKey: "" })
      await client.setup(n, password)
      // Created — sign straight in with the same credentials.
      await connect(baseUrl, { kind: "password", name: n, password }, false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex items-center justify-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="block size-4.5 rounded-full border-2 border-current" />
          </span>
          <span className="font-heading font-semibold text-2xl tracking-tight">
            apod
          </span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome — create your admin account</CardTitle>
            <CardDescription>
              This is a fresh apod instance. Create the first administrator to
              get started. This screen disables itself afterward.
            </CardDescription>
          </CardHeader>
          <CardPanel>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-name">Admin username</Label>
                <Input
                  id="admin-name"
                  autoComplete="username"
                  spellCheck={false}
                  placeholder="admin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <Alert variant="error">
                  <AlertTitle>Setup failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={busy || !name.trim() || !password}>
                {busy ? <Spinner className="size-4" /> : <RocketIcon />}
                Create admin
              </Button>
            </form>
          </CardPanel>
        </Card>
      </div>
    </div>
  )
}
