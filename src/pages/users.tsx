import { useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { KeyRoundIcon, LockIcon, Trash2Icon, UserPlusIcon } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { CopyButton } from "@/components/copy-button"
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-state"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useApi } from "@/lib/auth"
import { useAction } from "@/lib/use-action"
import { timeAgo } from "@/lib/format"

const USERNAME_RE = /^[a-z_][a-z0-9_-]{0,31}$/
const MIN_PASSWORD_LENGTH = 8

function SetPasswordDialog({
  userName,
  open,
  onOpenChange,
}: {
  userName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { api } = useApi()
  const [password, setPassword] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)

  const setUserPassword = useAction({
    fn: () => api.setUserPassword(userName!, password),
    invalidates: [["users"]],
    successTitle: "Password set — existing sessions were signed out",
    onSuccess: () => {
      setPassword("")
      onOpenChange(false)
    },
  })

  function handleSave(e: FormEvent) {
    e.preventDefault()
    setValidationError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setValidationError(
        `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      )
      return
    }
    setUserPassword.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          setPassword("")
          setValidationError(null)
        }
      }}
    >
      <DialogPopup>
        <form onSubmit={handleSave} className="contents">
          <DialogHeader>
            <DialogTitle>Set password for {userName}</DialogTitle>
            <DialogDescription>
              Lets the user sign in to this UI with username + password.
              Setting a new password signs out their existing sessions.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {validationError && (
              <p className="text-destructive-foreground text-xs">{validationError}</p>
            )}
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!password || setUserPassword.isPending}>
              {setUserPassword.isPending && <Spinner className="size-4" />}
              Save password
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}

export function UsersPage() {
  const { api } = useApi()
  const [name, setName] = useState("")
  const [role, setRole] = useState("user")
  const [nameError, setNameError] = useState<string | null>(null)
  // API keys are shown exactly once; keep the latest one visible until dismissed.
  const [freshKey, setFreshKey] = useState<{ user: string; key: string } | null>(null)
  const [passwordTarget, setPasswordTarget] = useState<string | null>(null)

  const users = useQuery({ queryKey: ["users"], queryFn: api.listUsers })

  const create = useAction({
    fn: () => api.createUser(name.trim(), role),
    invalidates: [["users"]],
    onSuccess: (created) => {
      setName("")
      if (created.api_key) setFreshKey({ user: created.name, key: created.api_key })
    },
  })
  const resetKey = useAction({
    fn: (userName: string) => api.resetUserKey(userName),
    invalidates: [["users"]],
    onSuccess: (updated, userName) => {
      if (updated.api_key) setFreshKey({ user: userName, key: updated.api_key })
    },
  })
  const remove = useAction({
    fn: (userName: string) => api.deleteUser(userName),
    invalidates: [["users"]],
    successTitle: "User deleted",
  })

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    setNameError(null)
    const n = name.trim()
    if (!USERNAME_RE.test(n)) {
      setNameError(
        "Usernames must start with a letter and contain only lowercase letters, digits, - and _.",
      )
      return
    }
    create.mutate()
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Each user gets a real Linux account, chrooted SFTP, and an API key."
      />

      <SetPasswordDialog
        userName={passwordTarget}
        open={passwordTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPasswordTarget(null)
        }}
      />

      {freshKey && (
        <Alert className="max-w-3xl">
          <KeyRoundIcon />
          <AlertTitle>API key for {freshKey.user}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              This key is shown only once — store it somewhere safe now. It
              won't be shown again.
            </span>
            <span className="flex items-center gap-1">
              <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                {freshKey.key}
              </code>
              <CopyButton value={freshKey.key} label="Copy API key" />
              <Button variant="ghost" size="sm" onClick={() => setFreshKey(null)}>
                Dismiss
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Create user</CardTitle>
          <CardDescription>
            Returns an API key the user can use with this UI or the CLI.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          <form className="flex flex-wrap items-start gap-2" onSubmit={handleCreate}>
            <div className="flex flex-col gap-1">
              <Input
                placeholder="name, e.g. client1"
                autoComplete="off"
                spellCheck={false}
                className="w-52"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {nameError && (
                <p className="max-w-52 text-destructive-foreground text-xs">
                  {nameError}
                </p>
              )}
            </div>
            <Select value={role} onValueChange={(v) => setRole(v as string)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectPopup>
            </Select>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? <Spinner className="size-4" /> : <UserPlusIcon />}
              Create user
            </Button>
          </form>
        </CardPanel>
      </Card>

      <Card className="max-w-3xl">
        <CardPanel>
          {users.isPending && <LoadingRows rows={3} />}
          {users.isError && <ErrorState error={users.error} />}
          {users.data &&
            (users.data.length === 0 ? (
              <EmptyState
                title="No users"
                description="Create a user to enable multi-tenant hosting."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>UID</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-64 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.data.map((u) => (
                    <TableRow key={u.name}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {u.has_password ? "password login" : "key only"}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{u.uid}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {timeAgo(u.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPasswordTarget(u.name)}
                          >
                            <LockIcon />
                            Set password
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="sm">
                                Reset key
                              </Button>
                            }
                            title={`Reset API key for ${u.name}`}
                            description="The current key stops working immediately. Anything using it (CLI, billing panels, this UI) must be updated with the new key."
                            confirmLabel="Reset"
                            onConfirm={() => resetKey.mutateAsync(u.name)}
                          />
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive-foreground"
                              >
                                <Trash2Icon />
                                Delete
                              </Button>
                            }
                            title={`Delete user ${u.name}`}
                            description="The Linux account and API key are removed. The user must have no sites."
                            confirmLabel="Delete"
                            typeToConfirm={u.name}
                            onConfirm={() => remove.mutateAsync(u.name)}
                          />
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}
        </CardPanel>
      </Card>
    </>
  )
}
