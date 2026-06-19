import { useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  KeyRoundIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  Trash2Icon,
} from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { CopyButton } from "@/components/copy-button"
import { EmptyState, LoadingRows } from "@/components/data-state"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { isTwoFactorRequired, useApi } from "@/lib/auth"
import { useAction } from "@/lib/use-action"
import { formatDate } from "@/lib/format"
import type { TokenAbility } from "@/lib/api"

const MIN_PASSWORD_LENGTH = 8
const ALL_ABILITIES: { id: TokenAbility; label: string; hint: string }[] = [
  { id: "read", label: "Read", hint: "View sites and configuration" },
  { id: "write", label: "Write", hint: "Create, update, and delete" },
  { id: "deploy", label: "Deploy", hint: "Deploy, rollback, start/stop/restart" },
]

function PasswordCard({ userName }: { userName: string }) {
  const { api } = useApi()
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)

  const update = useAction({
    fn: () => api.setUserPassword(userName, password, { currentPassword, code }),
    successTitle: "Password updated",
    onSuccess: () => {
      setCurrentPassword("")
      setPassword("")
      setCode("")
    },
  })

  // The server asks for a 2FA code when the account has 2FA enabled.
  const needsCode = isTwoFactorRequired(update.error)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setValidationError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setValidationError(`Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    update.mutate()
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Change the password you use to sign in to this UI. Enter your current
          password to confirm (leave blank if you haven&apos;t set one yet).
        </CardDescription>
      </CardHeader>
      <CardPanel>
        <form className="flex flex-wrap items-start gap-2" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <Label htmlFor="current-password" className="sr-only">
              Current password
            </Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              placeholder="Current password"
              className="w-64"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-password" className="sr-only">
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              className="w-64"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {validationError && (
              <p className="text-destructive-foreground text-xs">{validationError}</p>
            )}
          </div>
          {needsCode && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="password-2fa" className="sr-only">
                Authentication code
              </Label>
              <Input
                id="password-2fa"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="2FA code"
                className="w-32"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          )}
          <Button type="submit" disabled={!password || update.isPending}>
            {update.isPending && <Spinner className="size-4" />}
            Update password
          </Button>
        </form>
      </CardPanel>
    </Card>
  )
}

function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const { api } = useApi()
  const [secret, setSecret] = useState<string | null>(null)
  const [uri, setUri] = useState<string>("")
  const [code, setCode] = useState("")
  const [recovery, setRecovery] = useState<string[] | null>(null)
  const [disableOpen, setDisableOpen] = useState(false)
  const [disableCode, setDisableCode] = useState("")

  const begin = useAction({
    fn: () => api.twoFactorSetup(),
    onSuccess: (data) => {
      setSecret(data.secret)
      setUri(data.uri)
      setRecovery(null)
    },
  })
  const enable = useAction({
    fn: () => api.twoFactorEnable(code.trim()),
    invalidates: [["me"]],
    onSuccess: (data) => {
      setRecovery(data.recovery_codes)
      setSecret(null)
      setCode("")
    },
  })
  const disable = useAction({
    fn: () => api.twoFactorDisable(disableCode.trim()),
    invalidates: [["me"]],
    successTitle: "Two-factor authentication disabled",
    onSuccess: () => {
      setDisableOpen(false)
      setDisableCode("")
    },
  })

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Two-factor authentication
          <Badge variant="outline" className={enabled ? "text-success" : undefined}>
            {enabled ? "enabled" : "disabled"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Require a time-based code from an authenticator app at sign-in.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        {recovery && (
          <Alert>
            <KeyRoundIcon />
            <AlertTitle>Save your recovery codes</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>
                Each code works once if you lose your device. They won't be
                shown again.
              </span>
              <div className="grid grid-cols-2 gap-1 font-mono text-sm">
                {recovery.map((c) => (
                  <code key={c} className="rounded bg-muted px-2 py-1">
                    {c}
                  </code>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!enabled && !secret && (
          <Button
            className="self-start"
            disabled={begin.isPending}
            onClick={() => begin.mutate()}
          >
            {begin.isPending ? <Spinner className="size-4" /> : <ShieldCheckIcon />}
            Enable 2FA
          </Button>
        )}

        {!enabled && secret && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Add this secret to your authenticator app, then enter the code it
              shows.
            </p>
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                {secret}
              </code>
              <CopyButton value={uri || secret} label="Copy setup key" />
            </div>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (code.trim()) enable.mutate()
              }}
            >
              <div className="flex flex-col gap-1">
                <Label htmlFor="totp-verify">Verification code</Label>
                <Input
                  id="totp-verify"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="w-40"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={!code.trim() || enable.isPending}>
                {enable.isPending && <Spinner className="size-4" />}
                Verify and enable
              </Button>
            </form>
          </div>
        )}

        {enabled && (
          <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => setDisableOpen(true)}
            >
              <ShieldOffIcon />
              Disable 2FA
            </Button>
            <DialogPopup>
              <form
                className="contents"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (disableCode.trim()) disable.mutate()
                }}
              >
                <DialogHeader>
                  <DialogTitle>Disable two-factor authentication</DialogTitle>
                  <DialogDescription>
                    Enter a current code to confirm. This removes your secret and
                    recovery codes.
                  </DialogDescription>
                </DialogHeader>
                <DialogPanel className="flex flex-col gap-2">
                  <Label htmlFor="disable-code">Authentication code</Label>
                  <Input
                    id="disable-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                  />
                </DialogPanel>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDisableOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={!disableCode.trim() || disable.isPending}
                  >
                    {disable.isPending && <Spinner className="size-4" />}
                    Disable
                  </Button>
                </DialogFooter>
              </form>
            </DialogPopup>
          </Dialog>
        )}
      </CardPanel>
    </Card>
  )
}

function TokensCard() {
  const { api } = useApi()
  const [name, setName] = useState("")
  const [abilities, setAbilities] = useState<Set<TokenAbility>>(new Set(["read"]))
  const [sensitive, setSensitive] = useState(false)
  const [fresh, setFresh] = useState<string | null>(null)

  const tokens = useQuery({ queryKey: ["tokens"], queryFn: api.listTokens })

  const create = useAction({
    fn: () =>
      api.createToken(name.trim(), Array.from(abilities), sensitive, 0),
    invalidates: [["tokens"]],
    onSuccess: (data) => {
      setFresh(data.token)
      setName("")
      setAbilities(new Set(["read"]))
      setSensitive(false)
    },
  })
  const revoke = useAction({
    fn: (id: number) => api.revokeToken(id),
    invalidates: [["tokens"]],
    successTitle: "Token revoked",
  })

  function toggle(ability: TokenAbility) {
    setAbilities((prev) => {
      const next = new Set(prev)
      if (next.has(ability)) next.delete(ability)
      else next.add(ability)
      return next
    })
  }

  const list = tokens.data?.tokens ?? []

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Scoped API tokens</CardTitle>
        <CardDescription>
          Limited-permission tokens for CI and automation. They can never manage
          users, passwords, 2FA, or other tokens.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        {fresh && (
          <Alert>
            <KeyRoundIcon />
            <AlertTitle>New token</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>Copy it now — it won't be shown again.</span>
              <span className="flex items-center gap-1">
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                  {fresh}
                </code>
                <CopyButton value={fresh} label="Copy token" />
                <Button variant="ghost" size="sm" onClick={() => setFresh(null)}>
                  Dismiss
                </Button>
              </span>
            </AlertDescription>
          </Alert>
        )}

        <form
          className="flex flex-col gap-3 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim() && abilities.size > 0) create.mutate()
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="token-name">Token name</Label>
            <Input
              id="token-name"
              placeholder="e.g. ci-deploy"
              autoComplete="off"
              spellCheck={false}
              className="max-w-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="font-medium text-sm">Abilities</legend>
            {ALL_ABILITIES.map((a) => (
              <Label key={a.id} className="flex items-center gap-2 font-normal text-sm">
                <Checkbox
                  checked={abilities.has(a.id)}
                  onCheckedChange={() => toggle(a.id)}
                />
                <span className="font-medium">{a.label}</span>
                <span className="text-muted-foreground">— {a.hint}</span>
              </Label>
            ))}
          </fieldset>
          <Label className="flex items-center gap-2 font-normal text-sm">
            <Checkbox
              checked={sensitive}
              onCheckedChange={(c) => setSensitive(c === true)}
            />
            <span className="font-medium">Sensitive data</span>
            <span className="text-muted-foreground">
              — allow reading secrets (env, DB credentials)
            </span>
          </Label>
          <Button
            type="submit"
            className="self-start"
            disabled={!name.trim() || abilities.size === 0 || create.isPending}
          >
            {create.isPending ? <Spinner className="size-4" /> : <PlusIcon />}
            Create token
          </Button>
        </form>

        {tokens.isPending && <LoadingRows rows={2} />}
        {tokens.data &&
          (list.length === 0 ? (
            <EmptyState title="No tokens" description="Create a scoped token above." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Abilities</TableHead>
                  <TableHead>Sensitive</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((tok) => (
                  <TableRow key={tok.id}>
                    <TableCell className="font-medium">{tok.name}</TableCell>
                    <TableCell>
                      <code className="font-mono text-sm">{tok.abilities}</code>
                    </TableCell>
                    <TableCell>
                      {tok.sensitive ? (
                        <Badge variant="outline" className="text-warning">
                          yes
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">no</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(tok.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Revoke ${tok.name}`}
                          >
                            <Trash2Icon />
                          </Button>
                        }
                        title={`Revoke ${tok.name}`}
                        description="Anything using this token stops working immediately."
                        confirmLabel="Revoke"
                        onConfirm={() => revoke.mutateAsync(tok.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}
      </CardPanel>
    </Card>
  )
}

export function ProfilePage() {
  const { api, session } = useApi()
  const me = useQuery({ queryKey: ["me"], queryFn: api.me })
  const userName = me.data?.name ?? session.name ?? ""

  return (
    <>
      <PageHeader
        title="Profile & security"
        description="Manage your password, two-factor authentication, and API tokens."
      />
      {me.isPending && <LoadingRows rows={4} />}
      {me.data && (
        <>
          {userName && <PasswordCard userName={userName} />}
          <TwoFactorCard enabled={Boolean(me.data.totp_enabled)} />
          <TokensCard />
        </>
      )}
    </>
  )
}
