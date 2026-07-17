import { useEffect, useRef, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon, RocketIcon } from "lucide-react"
import { DeployProgress } from "@/components/deploy-progress"
import { appendDeployEvent, type DeployEvent } from "@/lib/api"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toastManager } from "@/components/ui/toast"
import { useApi } from "@/lib/auth"

// Mirrors the server's domain validation to fail fast with a friendly message.
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

const RAM_OPTIONS = ["256M", "512M", "1G", "2G", "4G"]
const CPU_OPTIONS = ["0.5", "1", "2", "4"]
const STORAGE_OPTIONS = ["", "1G", "5G", "10G", "20G", "50G"]

export function SiteCreatePage() {
  const { api, session } = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAdmin = session.role === "admin"
  const canCreate = isAdmin || session.canCreateSites

  const drivers = useQuery({ queryKey: ["drivers"], queryFn: api.listDrivers })
  const users = useQuery({
    queryKey: ["users"],
    queryFn: api.listUsers,
    enabled: isAdmin,
  })

  const [domain, setDomain] = useState("")
  const [source, setSource] = useState<"driver" | "compose">("driver")
  const [driver, setDriver] = useState<string | null>(null)
  const [composeFile, setComposeFile] = useState("")
  const [ram, setRam] = useState("512M")
  const [cpu, setCpu] = useState("1")
  const [storage, setStorage] = useState("")
  const [repo, setRepo] = useState("")
  const [branch, setBranch] = useState("")
  const [owner, setOwner] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [deployEvents, setDeployEvents] = useState<DeployEvent[]>([])
  const streamRef = useRef<AbortController | null>(null)
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Abort the SSE stream and cancel the pending post-success navigate on unmount,
  // so neither leaks (a stray timer would yank a user who left the page).
  useEffect(
    () => () => {
      streamRef.current?.abort()
      if (navTimerRef.current) clearTimeout(navTimerRef.current)
    },
    [],
  )

  const create = useMutation({
    mutationFn: () => {
      const d = domain.trim().toLowerCase()
      // Stream live deploy progress alongside the (blocking) create call.
      setDeployEvents([])
      streamRef.current?.abort()
      const controller = new AbortController()
      streamRef.current = controller
      void api.streamDeployEvents(
        d,
        // Cap retained events, and reset when a new operation's run id arrives
        // so a stale replayed buffer (e.g. a just-finished destroy of the same
        // domain) can't bleed into this create's progress.
        (ev) => setDeployEvents((prev) => appendDeployEvent(prev, ev)),
        controller.signal,
      )
      return api.createSite({
        domain: d,
        driver: source === "driver" ? driver! : undefined,
        compose_file: source === "compose" ? composeFile : undefined,
        ram,
        cpu,
        storage: storage || undefined,
        repo: repo.trim() || undefined,
        branch: branch.trim() || undefined,
        owner: owner || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] })
      toastManager.add({
        title: "Site created",
        description: `${domain.trim().toLowerCase()} is being provisioned.`,
        type: "success",
      })
      // Let the final "Ready" step render briefly before navigating away.
      const d = domain.trim().toLowerCase()
      navTimerRef.current = setTimeout(() => {
        streamRef.current?.abort()
        navigate({ to: "/sites/$domain", params: { domain: d } })
      }, 1200)
    },
    onError: () => streamRef.current?.abort(),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setValidationError(null)
    const d = domain.trim().toLowerCase()
    if (!DOMAIN_RE.test(d)) {
      setValidationError(
        "Enter a valid domain name, e.g. example.com or app.example.com.",
      )
      return
    }
    if (source === "driver" && !driver) {
      setValidationError("Choose a driver for the application stack.")
      return
    }
    if (source === "compose" && !composeFile.trim()) {
      setValidationError("Paste a docker-compose.yml to run.")
      return
    }
    create.mutate()
  }

  if (!canCreate) {
    return (
      <>
        <PageHeader
          title="New site"
          description="Provision an isolated container stack with automatic SSL."
          actions={
            <Button variant="ghost" render={<Link to="/sites" />}>
              <ArrowLeftIcon />
              Back to sites
            </Button>
          }
        />
        <Alert className="max-w-2xl">
          <AlertTitle>You can't create sites</AlertTitle>
          <AlertDescription>
            Your account doesn't have permission to provision sites. Ask an
            administrator to grant you site-creation access.
          </AlertDescription>
        </Alert>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="New site"
        description="Provision an isolated container stack with automatic SSL."
        actions={
          <Button variant="ghost" render={<Link to="/sites" />}>
            <ArrowLeftIcon />
            Back to sites
          </Button>
        }
      />

      {create.isPending || create.isSuccess ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Deploying {domain.trim().toLowerCase()}</CardTitle>
            <CardDescription>
              Provisioning the container stack — this can take a moment while
              images are pulled. You can safely leave this page; the deployment
              continues in the background.
            </CardDescription>
          </CardHeader>
          <CardPanel>
            <DeployProgress events={deployEvents} />
          </CardPanel>
        </Card>
      ) : (
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Site details</CardTitle>
            <CardDescription>
              The domain must already point at this server for SSL issuance to
              succeed.
            </CardDescription>
          </CardHeader>
          <CardPanel className="flex flex-col gap-5">
            <div className="flex max-w-xs flex-col gap-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                placeholder="example.com"
                autoComplete="off"
                spellCheck={false}
                required
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Application source</Label>
              <Tabs
                value={source}
                onValueChange={(v) => setSource(v as "driver" | "compose")}
              >
                <TabsList className="w-full *:flex-1">
                  <TabsTab value="driver">Driver</TabsTab>
                  <TabsTab value="compose">Compose file</TabsTab>
                </TabsList>
                <TabsPanel value="driver" className="pt-3">
                  <Select
                    value={driver}
                    onValueChange={(v) => setDriver(v as string | null)}
                  >
                    <SelectTrigger id="driver" aria-label="Driver" className="w-full">
                      <SelectValue placeholder={drivers.isPending ? "Loading…" : "Choose a stack"} />
                    </SelectTrigger>
                    <SelectPopup>
                      {(drivers.data ?? []).map((d) => (
                        <SelectItem key={d.name} value={d.name}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </TabsPanel>
                <TabsPanel value="compose" className="flex flex-col gap-2 pt-3">
                  <Textarea
                    id="compose-file"
                    aria-label="docker-compose.yml"
                    placeholder={"# Paste a docker-compose.yml — apod runs it as-is\nservices:\n  app:\n    image: lscr.io/linuxserver/sonarr\n    ports:\n      - 8989:8989"}
                    spellCheck={false}
                    rows={10}
                    className="font-mono text-xs"
                    value={composeFile}
                    onChange={(e) => setComposeFile(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    apod auto-detects the web service and port — no driver
                    needed.
                  </p>
                </TabsPanel>
              </Tabs>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ram">RAM limit</Label>
                <Select value={ram} onValueChange={(v) => setRam(v as string)}>
                  <SelectTrigger id="ram" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {RAM_OPTIONS.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cpu">CPU cores</Label>
                <Select value={cpu} onValueChange={(v) => setCpu(v as string)}>
                  <SelectTrigger id="cpu" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {CPU_OPTIONS.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="storage">Disk quota</Label>
                <Select value={storage} onValueChange={(v) => setStorage(v as string)}>
                  <SelectTrigger id="storage" className="w-full">
                    <SelectValue>
                      {(v: string) => (v ? v : "Unlimited")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {STORAGE_OPTIONS.map((v) => (
                      <SelectItem key={v || "none"} value={v}>
                        {v || "Unlimited"}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="repo">
                  Git repository{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="repo"
                  placeholder="https://github.com/you/app.git"
                  autoComplete="off"
                  spellCheck={false}
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="branch">
                  Branch{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="branch"
                  placeholder="main"
                  autoComplete="off"
                  spellCheck={false}
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
            </div>

            {isAdmin && (
              <div className="flex max-w-xs flex-col gap-2">
                <Label htmlFor="owner">Owner</Label>
                <Select value={owner} onValueChange={(v) => setOwner(v as string)}>
                  <SelectTrigger id="owner" className="w-full">
                    <SelectValue>
                      {(v: string) => (v ? v : "admin (no quota)")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="">admin (no quota)</SelectItem>
                    {(users.data ?? [])
                      .filter((u) => u.role !== "admin")
                      .map((u) => (
                        <SelectItem key={u.name} value={u.name}>
                          {u.name}
                        </SelectItem>
                      ))}
                  </SelectPopup>
                </Select>
              </div>
            )}

            {(validationError || create.isError) && (
              <Alert variant="error">
                <AlertTitle>Could not create site</AlertTitle>
                <AlertDescription>
                  {validationError ||
                    (create.error instanceof Error
                      ? create.error.message
                      : "Unknown error")}
                </AlertDescription>
              </Alert>
            )}
          </CardPanel>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline" type="button" render={<Link to="/sites" />}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Spinner className="size-4" /> : <RocketIcon />}
              {create.isPending ? "Provisioning…" : "Create site"}
            </Button>
          </CardFooter>
        </Card>
      </form>
      )}
    </>
  )
}
