import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearch } from "@tanstack/react-router"
import { BoxIcon, ChevronRightIcon, TerminalIcon } from "lucide-react"
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
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useApi } from "@/lib/auth"
import type { ProcessInfo, Site, TerminalToken } from "@/lib/api"

interface HistoryEntry {
  command: string
  output: string
  error?: boolean
}

// The default target ("") resolves server-side to the site's primary/app
// container, so it always works even before processes have loaded.
const PRIMARY = ""

export function ConsoleTab({ site }: { site: Site }) {
  const { api } = useApi()
  const search = useSearch({ strict: false }) as { service?: string }
  const [token, setToken] = useState<TerminalToken | null>(null)
  const [service, setService] = useState<string>(search.service ?? PRIMARY)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [command, setCommand] = useState("")
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const running_site = site.status === "running"
  const expired = token ? new Date(token.expires_at).getTime() < Date.now() : false
  const active = token !== null && !expired

  // The site's containers, so the operator can pick which one to open.
  const procs = useQuery({
    queryKey: ["processes", site.domain],
    queryFn: () => api.listProcesses(site.domain),
    enabled: running_site,
  })
  const targets = useMemo(() => buildTargets(procs.data), [procs.data])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [history])

  async function startSession() {
    setStarting(true)
    setStartError(null)
    try {
      const t = await api.createTerminalToken(site.domain, service || undefined)
      setToken(t)
      setHistory([])
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Could not start session.")
    } finally {
      setStarting(false)
    }
  }

  function endSession() {
    setToken(null)
    setHistory([])
  }

  async function runCommand(e: FormEvent) {
    e.preventDefault()
    const cmd = command.trim()
    if (!cmd || !token || running) return
    setRunning(true)
    setCommand("")
    try {
      const { output } = await api.terminalExec(token.token, cmd)
      setHistory((h) => [...h, { command: cmd, output }])
    } catch (err) {
      setHistory((h) => [
        ...h,
        {
          command: cmd,
          output: err instanceof Error ? err.message : "command failed",
          error: true,
        },
      ])
    } finally {
      setRunning(false)
    }
  }

  if (!running_site) {
    return (
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Console</CardTitle>
        </CardHeader>
        <CardPanel>
          <p className="text-muted-foreground text-sm">
            The site is not running. Start it to open a console session.
          </p>
        </CardPanel>
      </Card>
    )
  }

  const targetLabel =
    targets.find((t) => t.value === service)?.label ?? "Primary container"

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Console</CardTitle>
        <CardDescription>
          Commands run inside the selected container — never the host. Sessions
          are scoped to this site, expire after 5 minutes, and dangerous
          commands are blocked server-side.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        {!active && (
          <div className="flex flex-col items-start gap-3">
            {expired && (
              <Alert>
                <TerminalIcon />
                <AlertTitle>Session expired</AlertTitle>
                <AlertDescription>
                  Terminal tokens are valid for 5 minutes. Start a new session
                  to continue.
                </AlertDescription>
              </Alert>
            )}
            {startError && (
              <Alert variant="error">
                <AlertTitle>Could not start session</AlertTitle>
                <AlertDescription>{startError}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-sm">Container</span>
              <Select
                value={service}
                onValueChange={(v) => setService(v as string)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue>{targetLabel}</SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {targets.map((t) => (
                    <SelectItem key={t.value || "primary"} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
            <Button disabled={starting} onClick={startSession}>
              {starting ? <Spinner className="size-4" /> : <TerminalIcon />}
              Start session
            </Button>
          </div>
        )}

        {active && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground text-sm">
                <BoxIcon className="size-4" />
                Connected to{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground text-xs">
                  {token?.service || targetLabel}
                </code>
              </span>
              <Button variant="outline" size="sm" onClick={endSession}>
                Switch container
              </Button>
            </div>
            <div
              ref={scrollRef}
              className="max-h-96 min-h-48 overflow-y-auto rounded-lg border bg-zinc-950 p-4 font-mono text-xs text-zinc-100 leading-relaxed dark:bg-zinc-900"
            >
              {history.length === 0 && (
                <p className="text-zinc-500">
                  Session active on {site.domain}. Type a command below.
                </p>
              )}
              {history.map((entry, i) => (
                <div key={i} className="mb-3">
                  <p className="flex items-center gap-1 text-emerald-400">
                    <ChevronRightIcon className="size-3" />
                    {entry.command}
                  </p>
                  <pre
                    className={`mt-1 whitespace-pre-wrap ${entry.error ? "text-red-400" : ""}`}
                  >
                    {entry.output}
                  </pre>
                </div>
              ))}
              {running && <Spinner className="size-4 text-zinc-400" />}
            </div>
            <form className="flex gap-2" onSubmit={runCommand}>
              <Input
                placeholder="command, e.g. ls -la"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                disabled={running}
              />
              <Button type="submit" disabled={!command.trim() || running}>
                Run
              </Button>
            </form>
          </>
        )}
      </CardPanel>
    </Card>
  )
}

// buildTargets lists the containers a console can open: the primary container
// first, then every service reported for the site.
function buildTargets(
  procs: ProcessInfo[] | undefined,
): { value: string; label: string }[] {
  const out = [{ value: PRIMARY, label: "Primary container" }]
  for (const p of procs ?? []) {
    out.push({
      value: p.service,
      label: p.replicas > 1 ? `${p.service} (×${p.replicas})` : p.service,
    })
  }
  return out
}
