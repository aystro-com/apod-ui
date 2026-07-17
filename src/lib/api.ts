// Typed client for the apod REST API (https://github.com/aystro-com/apod).
// Every response is wrapped in { ok, data } / { ok: false, error }.

export interface Site {
  id: number
  domain: string
  driver: string
  status: string
  ram: string
  cpu: string
  storage?: string
  env: string
  repo?: string
  branch?: string
  owner?: string
  created_at: string
  updated_at: string
}

export interface SiteStats {
  domain: string
  status: string
  cpu_percent: number
  memory_mb: number
  memory_limit_mb: number
  memory_percent: number
}

export interface ServerStats {
  cpu_count: number
  mem_total_mb: number
  mem_used_mb: number
  mem_percent: number
  disk_total_gb: number
  disk_used_gb: number
  disk_percent: number
  site_count: number
}

export interface DiskUsage {
  domain: string
  size_mb: number
}

export interface Deployment {
  id: number
  site_domain: string
  commit_hash: string
  branch: string
  status: string
  previous_image: string
  created_at: string
}

export interface Backup {
  id: number
  site_domain: string
  storage_name: string
  path: string
  size_bytes: number
  status: string
  created_at: string
}

export interface ContainerRef {
  name: string
  ip: string
  running: boolean
}

export interface SharedNetwork {
  name: string
  owner: string
  members: string[]
}

// One container reachable over a shared network (architecture neighbor view).
export interface NetworkNeighbor {
  network: string
  site: string
  service: string
  name: string
  ip: string
  running: boolean
}

export interface ProcessInfo {
  service: string
  role: string
  image: string
  command: string
  replicas: number
  running: number
  scalable: boolean
  containers: ContainerRef[]
}

/** What a site is currently busy with (the held per-site operation lock). */
export interface SiteActivity {
  operation: string
  since: string
  held: boolean
}

export interface BackupSchedule {
  id: number
  site_domain: string
  cron_expr: string
  storage_name: string
  keep_count: number
  created_at: string
}

export interface StorageConfig {
  id: number
  name: string
  driver: string
  config: string
  created_at: string
}

export interface CronJob {
  id: number
  site_domain: string
  schedule: string
  command: string
  service: string
  active: boolean
  created_at: string
}

export interface ProxyRule {
  id: number
  site_domain: string
  rule_type: string
  config: string
  created_at: string
}

export interface IPRule {
  id: number
  site_domain: string
  ip: string
  action: string
  created_at: string
}

export interface FTPAccount {
  id: number
  site_domain: string
  username: string
  created_at: string
}

export interface SSHKey {
  id: number
  name: string
  public_key: string
  created_at: string
}

export interface ApodUser {
  id: number
  name: string
  uid: number
  role: string
  api_key?: string
  has_password?: boolean
  can_create_sites?: boolean
  created_at: string
}

export interface Identity {
  name: string
  role: string
  totp_enabled?: boolean
  can_create_sites?: boolean
}

export interface LoginResponse {
  token: string
  user: Identity
}

export type TokenAbility = "read" | "write" | "deploy"

export interface ApiToken {
  id: number
  user_name: string
  name: string
  abilities: string
  sensitive: boolean
  expires_at?: string | null
  created_at: string
}

export interface TwoFactorSetup {
  secret: string
  uri: string
}

export interface Operation {
  id: number
  site_domain: string
  action: string
  details: string
  result: string
  created_at: string
}

export interface UptimeConfig {
  id: number
  site_domain: string
  url: string
  interval_seconds: number
  alert_webhook: string
  active: boolean
  created_at: string
}

export interface UptimeStatus extends UptimeConfig {
  // Absent until the first check has run.
  uptime_percent?: number
  avg_response_ms?: number
  total_checks: number
}

export interface UptimeCheck {
  id: number
  site_domain: string
  status: string
  status_code: number
  response_ms: number
  created_at: string
}

export interface Webhook {
  id: number
  site_domain: string
  token: string
  created_at: string
}

export interface DriverInfo {
  name: string
  version?: string
  description?: string
}

export interface DriverDetail {
  name: string
  yaml: string
  builtin: boolean
}

export interface DriverParamPreview {
  name: string
  type: string
  default: string
  options?: string[]
}

export interface DriverPreview {
  name: string
  version: string
  description: string
  type: string
  parameters: DriverParamPreview[]
  services: string[]
  compose: boolean
  files: number
  cron_jobs: number
  setup_steps: number
  warnings: string[]
}

export interface FirewallRule {
  num: number
  to: string
  action: string
  from: string
}

export interface VersionInfo {
  version: string
  db_version: number
}

export interface UpdateCheck {
  current?: string
  latest: string
  has_update: boolean
}

export interface FirewallStatus {
  enabled: boolean
  rules?: string[]
  status?: string
}

export interface TerminalToken {
  token: string
  domain: string
  service: string
  expires_at: string
}

// GET /sites/{domain}/info returns a FLAT map: domain/driver/url plus each
// generated credential (DB creds, dashboard password, anon/service keys, …) as
// its own key. Flat (not a nested object) so every value renders as a string.
export type SiteInfo = Record<string, string>

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

interface Envelope<T> {
  ok: boolean
  data?: T
  error?: string
}

export interface ApiClientOptions {
  baseUrl: string
  apiKey: string
  onUnauthorized?: () => void
}

export interface DeployEvent {
  step: string
  status: "running" | "done" | "error"
  detail?: string
  percent: number
  /** Per-domain operation id; changes when a new operation begins. */
  run: number
  time: string
}

/** Max bytes the SSE parser will hold without a frame delimiter before bailing. */
const MAX_SSE_BUFFER = 256 * 1024

/**
 * Coerce an untrusted parsed SSE payload into a well-formed DeployEvent, or
 * null if it can't be. The server is trusted, but protocol drift / a malformed
 * frame (e.g. a missing or non-numeric `percent`) would otherwise produce a
 * NaN progress bar or a blank checklist row downstream.
 */
function normalizeDeployEvent(raw: unknown): DeployEvent | null {
  if (typeof raw !== "object" || raw === null) return null
  const r = raw as Record<string, unknown>
  const status =
    r.status === "done" || r.status === "error" ? r.status : "running"
  const percentNum = Number(r.percent)
  const percent = Number.isFinite(percentNum)
    ? Math.min(100, Math.max(0, percentNum))
    : 0
  const runNum = Number(r.run)
  return {
    step: typeof r.step === "string" && r.step ? r.step : "Working…",
    status,
    detail: typeof r.detail === "string" ? r.detail : undefined,
    percent,
    run: Number.isFinite(runNum) ? runNum : 0,
    time: typeof r.time === "string" ? r.time : "",
  }
}

/**
 * Append a streamed event to the accumulated list, but start a fresh list when
 * the operation changes (its `run` id differs from the events already held).
 * This is what stops a retained buffer from a just-finished operation — e.g. a
 * destroy whose final 100% event is replayed when the next subscriber connects —
 * from bleeding into the next operation and pinning its progress bar.
 */
export function appendDeployEvent(
  prev: DeployEvent[],
  ev: DeployEvent,
  max = 500,
): DeployEvent[] {
  const lastRun = prev[prev.length - 1]?.run
  if (lastRun !== undefined && ev.run !== lastRun) return [ev]
  return [...prev, ev].slice(-max)
}

export class ApiClient {
  private baseUrl: string
  private apiKey: string
  private onUnauthorized?: () => void

  constructor({ baseUrl, apiKey, onUnauthorized }: ApiClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
    this.apiKey = apiKey
    this.onUnauthorized = onUnauthorized
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    let res: Response
    try {
      res = await fetch(this.baseUrl + path, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch {
      throw new ApiError(0, "Cannot reach the apod server. Check the server URL and your network.")
    }

    let envelope: Envelope<T> = { ok: false }
    let parseFailed = false
    try {
      envelope = (await res.json()) as Envelope<T>
    } catch {
      parseFailed = true
    }

    if (res.status === 401) {
      // A "2fa_required" 401 is an expected step-up challenge on an otherwise
      // valid session (e.g. changing a password with 2FA on) — NOT an expired
      // session. Firing onUnauthorized here would clear the session and bounce
      // the user to the login screen instead of letting the caller prompt for a
      // code, making self-service 2FA password changes impossible.
      if (!/2fa_required/.test(envelope.error ?? "")) {
        this.onUnauthorized?.()
      }
      throw new ApiError(401, envelope.error || "Session expired or API key revoked.")
    }
    if (res.status === 429) {
      throw new ApiError(429, "Rate limit reached (60 requests/minute). Please wait a moment.")
    }
    if (parseFailed) {
      throw new ApiError(res.status, `Unexpected response from server (HTTP ${res.status}).`)
    }

    if (!res.ok || !envelope.ok) {
      throw new ApiError(res.status, envelope.error || `Request failed (HTTP ${res.status}).`)
    }
    return envelope.data as T
  }

  private get<T>(path: string) {
    return this.request<T>("GET", path)
  }
  private post<T>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body)
  }
  private delete<T>(path: string, body?: unknown) {
    return this.request<T>("DELETE", path, body)
  }

  private sitePath(domain: string, rest = ""): string {
    return `/api/v1/sites/${encodeURIComponent(domain)}${rest}`
  }

  // Sites
  listSites = () => this.get<Site[]>("/api/v1/sites")
  getSite = (domain: string) => this.get<Site>(this.sitePath(domain))
  getSiteActivity = (domain: string) =>
    this.get<SiteActivity>(this.sitePath(domain, "/activity"))
  getSiteInfo = (domain: string) =>
    this.get<SiteInfo>(this.sitePath(domain, "/info"))
  createSite = (body: {
    domain: string
    driver?: string
    compose_file?: string
    ram?: string
    cpu?: string
    storage?: string
    repo?: string
    branch?: string
    owner?: string
  }) => this.post<Site>("/api/v1/sites", body)

  /**
   * Streams a site's live operation progress (Server-Sent Events) via fetch —
   * EventSource can't send the Bearer header, so we read the body ourselves.
   * The stream now carries any long operation (deploy, update, clone, destroy,
   * backup, restore…), not just deploys. Resolves when the stream ends
   * (terminal event, disconnect, or abort). Retries briefly on 404 to cover the
   * gap between firing createSite and the site record existing server-side.
   */
  streamDeployEvents = async (
    domain: string,
    onEvent: (ev: DeployEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> => {
    const url = this.baseUrl + this.sitePath(domain, "/events")
    let res: Response | undefined
    // Retry on 404 for ~15s to cover the gap between firing createSite and the
    // site record existing — a slow provision (image pull) can take several
    // seconds, and giving up after ~1.6s left the create with no live progress.
    for (let attempt = 0; attempt < 30; attempt++) {
      if (signal?.aborted) return
      try {
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "text/event-stream" },
          signal,
        })
      } catch {
        return // aborted or network gone — nothing to stream
      }
      if (res.status !== 404) break
      await new Promise((r) => setTimeout(r, 500)) // record not created yet
    }
    if (!res || !res.ok || !res.body) return

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ""
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        // Guard against a server that never sends a frame delimiter: drop the
        // buffer rather than letting it grow without bound (tab OOM).
        if (buf.length > MAX_SSE_BUFFER) {
          buf = ""
          continue
        }
        const frames = buf.split("\n\n")
        buf = frames.pop() ?? ""
        for (const frame of frames) {
          // Per the SSE spec the space after "data:" is optional, so match
          // "data:" and strip a single optional leading space — otherwise a
          // server emitting "data:{...}" would have every event silently dropped.
          const line = frame.split("\n").find((l) => l.startsWith("data:"))
          if (!line) continue
          const payload = line.slice(5).replace(/^ /, "")
          try {
            const ev = normalizeDeployEvent(JSON.parse(payload))
            if (ev) onEvent(ev)
          } catch {
            /* ignore malformed frame */
          }
        }
      }
    } catch {
      /* aborted mid-stream */
    } finally {
      reader.releaseLock()
    }
  }
  startSite = (domain: string) => this.post<unknown>(this.sitePath(domain, "/start"))
  stopSite = (domain: string) => this.post<unknown>(this.sitePath(domain, "/stop"))
  restartSite = (domain: string) => this.post<unknown>(this.sitePath(domain, "/restart"))
  updateSite = (domain: string) => this.post<unknown>(this.sitePath(domain, "/update"))
  destroySite = (domain: string, purge: boolean) =>
    this.delete<unknown>(this.sitePath(domain) + (purge ? "?purge=true" : ""))
  cloneSite = (domain: string, target: string) =>
    this.post<unknown>(this.sitePath(domain, "/clone"), { target })
  exportSite = (domain: string, outputDir?: string) =>
    this.post<Record<string, string>>(this.sitePath(domain, "/export"), {
      output_dir: outputDir || "",
    })
  transferSite = (domain: string, owner: string) =>
    this.post<unknown>(this.sitePath(domain, "/transfer"), { owner })

  // Drivers
  listDrivers = () => this.get<DriverInfo[]>("/api/v1/drivers")
  getDriver = (name: string) =>
    this.get<DriverDetail>(`/api/v1/drivers/${encodeURIComponent(name)}`)
  validateDriver = (yaml: string) =>
    this.post<DriverPreview>("/api/v1/drivers/validate", { yaml })
  saveDriver = (name: string, yaml: string) =>
    this.post<unknown>("/api/v1/drivers", { name, yaml })
  deleteDriver = (name: string) =>
    this.delete<unknown>(`/api/v1/drivers/${encodeURIComponent(name)}`)

  // Domains
  listDomains = (domain: string) => this.get<string[]>(this.sitePath(domain, "/domains"))
  addDomain = (domain: string, alias: string) =>
    this.post<unknown>(this.sitePath(domain, "/domains"), { domain: alias })
  removeDomain = (domain: string, alias: string) =>
    this.delete<unknown>(this.sitePath(domain, `/domains/${encodeURIComponent(alias)}`))

  // Config
  getConfig = (domain: string) =>
    this.get<Record<string, string>>(this.sitePath(domain, "/config"))
  setConfig = (domain: string, key: string, value: string) =>
    this.post<unknown>(this.sitePath(domain, "/config"), { key, value })

  // Env vars
  listEnv = (domain: string) =>
    this.get<Record<string, string>>(this.sitePath(domain, "/env"))
  setEnv = (domain: string, key: string, value: string) =>
    this.post<unknown>(this.sitePath(domain, "/env"), { key, value })
  unsetEnv = (domain: string, key: string) =>
    this.delete<unknown>(this.sitePath(domain, `/env/${encodeURIComponent(key)}`))

  // Deploys
  deploy = (domain: string, branch?: string) =>
    this.post<unknown>(this.sitePath(domain, "/deploy"), { branch: branch || "" })
  rollback = (domain: string) => this.post<unknown>(this.sitePath(domain, "/rollback"))
  listDeployments = (domain: string) =>
    this.get<Deployment[]>(this.sitePath(domain, "/deployments"))

  // Webhooks
  createWebhook = (domain: string) =>
    this.post<{ token: string; url: string }>(this.sitePath(domain, "/webhook"))
  listWebhooks = (domain: string) =>
    this.get<Webhook[]>(this.sitePath(domain, "/webhook"))
  deleteWebhook = (domain: string) =>
    this.delete<unknown>(this.sitePath(domain, "/webhook"))

  // Backups
  createBackup = (domain: string, storage?: string) =>
    this.post<{ backup_id: number }>(this.sitePath(domain, "/backups"), {
      storage: storage || "",
    })
  listBackups = (domain: string) => this.get<Backup[]>(this.sitePath(domain, "/backups"))
  restoreBackup = (domain: string, backupId: number) =>
    this.post<unknown>(this.sitePath(domain, "/backups/restore"), { backup_id: backupId })
  newSiteFromBackup = (domain: string, backupId: number, newDomain: string, owner = "") =>
    this.post<unknown>(this.sitePath(domain, "/backups/new-site"), {
      backup_id: backupId,
      new_domain: newDomain,
      owner,
    })
  deleteBackup = (domain: string, backupId: number) =>
    this.delete<unknown>(this.sitePath(domain, "/backups"), { backup_id: backupId })

  // Shared networks (connect sites privately)
  listNetworks = () => this.get<SharedNetwork[]>("/api/v1/networks")
  createNetwork = (name: string) =>
    this.post<unknown>("/api/v1/networks", { name })
  deleteNetwork = (name: string) =>
    this.delete<unknown>(`/api/v1/networks/${encodeURIComponent(name)}`)
  addNetworkMember = (name: string, domain: string) =>
    this.post<unknown>(
      `/api/v1/networks/${encodeURIComponent(name)}/members`,
      { domain },
    )
  removeNetworkMember = (name: string, domain: string) =>
    this.delete<unknown>(
      `/api/v1/networks/${encodeURIComponent(name)}/members/${encodeURIComponent(domain)}`,
    )
  getSiteNetwork = (domain: string) =>
    this.get<NetworkNeighbor[]>(this.sitePath(domain, "/network"))

  // Processes (web / workers / scheduler)
  listProcesses = (domain: string) =>
    this.get<ProcessInfo[]>(this.sitePath(domain, "/processes"))
  scaleProcess = (domain: string, service: string, replicas: number) =>
    this.post<unknown>(
      this.sitePath(domain, `/processes/${encodeURIComponent(service)}/scale`),
      { replicas },
    )
  restartProcess = (domain: string, service: string) =>
    this.post<unknown>(
      this.sitePath(domain, `/processes/${encodeURIComponent(service)}/restart`),
    )

  // Backup schedules
  addBackupSchedule = (domain: string, every: string, keep: number, storage?: string) =>
    this.post<unknown>(this.sitePath(domain, "/backups/schedule"), {
      every,
      keep,
      storage: storage || "",
    })
  listBackupSchedules = (domain: string) =>
    this.get<BackupSchedule[]>(this.sitePath(domain, "/backups/schedule"))
  removeBackupSchedule = (domain: string, scheduleId: number) =>
    this.delete<unknown>(this.sitePath(domain, "/backups/schedule"), {
      schedule_id: scheduleId,
    })

  // Storage configs
  addStorage = (name: string, driver: string, config: Record<string, string>) =>
    this.post<unknown>("/api/v1/storage", { name, driver, config })
  listStorage = () => this.get<StorageConfig[]>("/api/v1/storage")
  removeStorage = (name: string) =>
    this.delete<unknown>(`/api/v1/storage/${encodeURIComponent(name)}`)

  // Cron
  addCron = (domain: string, schedule: string, command: string, service?: string) =>
    this.post<unknown>(this.sitePath(domain, "/cron"), {
      schedule,
      command,
      service: service || "app",
    })
  listCron = (domain: string) => this.get<CronJob[]>(this.sitePath(domain, "/cron"))
  removeCron = (domain: string, id: number) =>
    this.delete<unknown>(this.sitePath(domain, "/cron"), { id })

  // Proxy rules
  addProxyRule = (domain: string, type: string, config: Record<string, string>) =>
    this.post<unknown>(this.sitePath(domain, "/proxy"), { type, config })
  listProxyRules = (domain: string) =>
    this.get<ProxyRule[]>(this.sitePath(domain, "/proxy"))
  removeProxyRule = (domain: string, id: number) =>
    this.delete<unknown>(this.sitePath(domain, "/proxy"), { id })

  // IP rules
  allowIP = (domain: string, ip: string) =>
    this.post<unknown>(this.sitePath(domain, "/ip/allow"), { ip })
  blockIP = (domain: string, ip: string) =>
    this.post<unknown>(this.sitePath(domain, "/ip/block"), { ip })
  unblockIP = (domain: string, ip: string) =>
    this.post<unknown>(this.sitePath(domain, "/ip/unblock"), { ip })
  listIPRules = (domain: string) => this.get<IPRule[]>(this.sitePath(domain, "/ip"))

  // FTP
  addFTP = (domain: string, username: string, password: string) =>
    this.post<unknown>(this.sitePath(domain, "/ftp"), { username, password })
  listFTP = (domain: string) => this.get<FTPAccount[]>(this.sitePath(domain, "/ftp"))
  removeFTP = (domain: string, username: string) =>
    this.delete<unknown>(this.sitePath(domain, `/ftp/${encodeURIComponent(username)}`))

  // Monitoring
  monitorSite = (domain: string) => this.get<SiteStats>(this.sitePath(domain, "/monitor"))
  monitorAll = () => this.get<SiteStats[]>("/api/v1/monitor")
  serverStats = () => this.get<ServerStats>("/api/v1/server-stats")
  diskUsage = () => this.get<DiskUsage[]>("/api/v1/disk-usage")
  containerLogs = (domain: string) =>
    this.get<{ logs: string }>(this.sitePath(domain, "/container-logs"))

  // Uptime
  enableUptime = (domain: string, url: string, interval: number, alertWebhook?: string) =>
    this.post<unknown>(this.sitePath(domain, "/uptime"), {
      url,
      interval,
      alert_webhook: alertWebhook || "",
    })
  uptimeStatus = (domain: string) =>
    this.get<UptimeStatus>(this.sitePath(domain, "/uptime"))
  disableUptime = (domain: string) => this.delete<unknown>(this.sitePath(domain, "/uptime"))
  uptimeLogs = (domain: string) =>
    this.get<UptimeCheck[]>(this.sitePath(domain, "/uptime/logs"))

  // Database
  dbExport = (domain: string) => this.get<{ dump: string }>(this.sitePath(domain, "/db/export"))
  dbImport = (domain: string, dump: string) =>
    this.post<unknown>(this.sitePath(domain, "/db/import"), { dump })

  // Activity logs
  siteLogs = (domain: string) => this.get<Operation[]>(this.sitePath(domain, "/logs"))
  allLogs = () => this.get<Operation[]>("/api/v1/logs")

  // Terminal
  createTerminalToken = (domain: string, service?: string) =>
    this.post<TerminalToken>(
      this.sitePath(
        domain,
        service ? `/terminal?service=${encodeURIComponent(service)}` : "/terminal",
      ),
    )
  terminalExec = (token: string, command: string) =>
    this.post<{ output: string }>("/api/v1/terminal/exec", { token, command })

  // Auth (sessions — requires apod with password login support)
  login = (name: string, password: string, code?: string) =>
    this.post<LoginResponse>("/api/v1/auth/login", {
      name,
      password,
      ...(code ? { code } : {}),
    })
  me = () => this.get<Identity>("/api/v1/auth/me")
  logout = () => this.post<unknown>("/api/v1/auth/logout")
  setUserPassword = (
    name: string,
    password: string,
    opts: { currentPassword?: string; code?: string } = {},
  ) =>
    this.post<unknown>(`/api/v1/users/${encodeURIComponent(name)}/password`, {
      password,
      current_password: opts.currentPassword,
      code: opts.code,
    })

  // Two-factor auth (self-service)
  twoFactorSetup = () =>
    this.post<TwoFactorSetup>("/api/v1/auth/2fa/setup")
  twoFactorEnable = (code: string) =>
    this.post<{ recovery_codes: string[] }>("/api/v1/auth/2fa/enable", { code })
  twoFactorDisable = (code: string) =>
    this.post<unknown>("/api/v1/auth/2fa/disable", { code })

  // Scoped personal access tokens
  createToken = (
    name: string,
    abilities: TokenAbility[],
    sensitive: boolean,
    ttlDays: number,
  ) =>
    this.post<{ token: string }>("/api/v1/tokens", {
      name,
      abilities,
      sensitive,
      ttl_days: ttlDays,
    })
  listTokens = () => this.get<{ tokens: ApiToken[] }>("/api/v1/tokens")
  revokeToken = (id: number) =>
    this.delete<unknown>("/api/v1/tokens", { id })

  // First-run setup
  setupStatus = () => this.get<{ needs_setup: boolean }>("/api/v1/setup/status")
  setup = (name: string, password: string) =>
    this.post<Identity>("/api/v1/setup", { name, password })

  // Users (admin)
  createUser = (name: string, role: string) =>
    this.post<ApodUser>("/api/v1/users", { name, role })
  listUsers = () => this.get<ApodUser[]>("/api/v1/users")
  deleteUser = (name: string) =>
    this.delete<unknown>(`/api/v1/users/${encodeURIComponent(name)}`)
  resetUserKey = (name: string) =>
    this.post<ApodUser>(`/api/v1/users/${encodeURIComponent(name)}/reset-key`)
  setUserCanCreateSites = (name: string, canCreateSites: boolean) =>
    this.post<unknown>(
      `/api/v1/users/${encodeURIComponent(name)}/permissions`,
      { can_create_sites: canCreateSites },
    )

  // Firewall (admin)
  firewallStatus = () => this.get<FirewallStatus>("/api/v1/firewall")
  firewallRules = () => this.get<FirewallRule[]>("/api/v1/firewall/rules")
  firewallEnable = () => this.post<unknown>("/api/v1/firewall/enable")
  firewallAllow = (port: string) => this.post<unknown>("/api/v1/firewall/allow", { port })
  firewallAllowFrom = (body: { source: string; port?: string; proto?: string }) =>
    this.post<unknown>("/api/v1/firewall/allow-from", body)
  firewallDeny = (port: string) => this.post<unknown>("/api/v1/firewall/deny", { port })
  firewallDelete = (num: number) =>
    this.post<unknown>("/api/v1/firewall/delete", { num })

  // SSH keys (admin)
  addSSHKey = (name: string, publicKey: string) =>
    this.post<unknown>("/api/v1/ssh-keys", { name, public_key: publicKey })
  listSSHKeys = () => this.get<SSHKey[]>("/api/v1/ssh-keys")
  removeSSHKey = (name: string) =>
    this.delete<unknown>(`/api/v1/ssh-keys/${encodeURIComponent(name)}`)

  // System (admin)
  version = () => this.get<VersionInfo>("/api/v1/version")
  checkUpdate = () => this.get<UpdateCheck>("/api/v1/update/check")
  update = () => this.post<unknown>("/api/v1/update")
  updateDrivers = () => this.post<unknown>("/api/v1/update/drivers")
}
