import { useState, type FormEvent } from "react"
import { KeyRoundIcon, LogInIcon, ShieldCheckIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { useAuth, isTwoFactorRequired, type Credentials } from "@/lib/auth"

export function LoginPage() {
  const { connect } = useAuth()
  const [mode, setMode] = useState<"password" | "key">("password")
  const [baseUrl, setBaseUrl] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [needsCode, setNeedsCode] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const credentials: Credentials =
      mode === "password"
        ? {
            kind: "password",
            name: username.trim(),
            password,
            code: code.trim() || undefined,
          }
        : { kind: "key", apiKey }
    try {
      await connect(baseUrl, credentials, remember)
    } catch (err) {
      if (isTwoFactorRequired(err)) {
        // Password was correct; prompt for the second factor and stay put.
        setNeedsCode(true)
        setError(null)
      } else {
        setError(err instanceof Error ? err.message : "Sign-in failed.")
      }
    } finally {
      setBusy(false)
    }
  }

  const canSubmit =
    mode === "password"
      ? username.trim() !== "" && password !== "" && (!needsCode || code.trim() !== "")
      : apiKey !== ""

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
            <CardTitle>Sign in to your server</CardTitle>
            <CardDescription>
              Use the password set with{" "}
              <code className="font-mono text-xs">apod user passwd</code>, or an
              API key.
            </CardDescription>
          </CardHeader>
          <CardPanel>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="server-url">Server URL</Label>
                <Input
                  id="server-url"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  placeholder="https://your-server:8443"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Leave empty if this UI is served from the same host as the
                  apod API.
                </p>
              </div>

              <Tabs
                value={mode}
                onValueChange={(v) => {
                  setMode(v as "password" | "key")
                  setError(null)
                }}
              >
                <TabsList className="w-full *:flex-1">
                  <TabsTab value="password">Password</TabsTab>
                  <TabsTab value="key">API key</TabsTab>
                </TabsList>
                <TabsPanel value="password" className="flex flex-col gap-4 pt-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      autoComplete="username"
                      spellCheck={false}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  {needsCode && (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="totp-code">Authentication code</Label>
                      <Input
                        id="totp-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        placeholder="123456 or a recovery code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                      />
                      <p className="text-muted-foreground text-xs">
                        Enter the 6-digit code from your authenticator app, or a
                        recovery code.
                      </p>
                    </div>
                  )}
                </TabsPanel>
                <TabsPanel value="key" className="flex flex-col gap-2 pt-4">
                  <Label htmlFor="api-key">API key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="apod_..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    From <code className="font-mono">apod user create</code> or{" "}
                    <code className="font-mono">apod user reset-key</code>.
                  </p>
                </TabsPanel>
              </Tabs>

              <Label className="flex items-center gap-2 font-normal text-sm">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(checked) => setRemember(checked === true)}
                />
                Remember on this device
              </Label>
              {error && (
                <Alert variant="error">
                  <KeyRoundIcon />
                  <AlertTitle>Sign-in failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={busy || !canSubmit}>
                {busy ? (
                  <Spinner className="size-4" />
                ) : mode === "password" ? (
                  <LogInIcon />
                ) : (
                  <ShieldCheckIcon />
                )}
                {mode === "password"
                  ? needsCode
                    ? "Verify"
                    : "Sign in"
                  : "Connect"}
              </Button>
            </form>
          </CardPanel>
        </Card>
        <p className="text-balance text-center text-muted-foreground text-xs">
          {mode === "password"
            ? "Passwords are exchanged for a 24-hour session token — nothing long-lived is stored in the browser."
            : `Your key is kept in ${remember ? "local" : "session"} storage on this device.`}{" "}
          Always use HTTPS for remote servers.
        </p>
      </div>
    </div>
  )
}
