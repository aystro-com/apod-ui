import { useCallback, useSyncExternalStore } from "react"
import { Link, Outlet, useLocation } from "@tanstack/react-router"
import {
  ActivityIcon,
  DatabaseIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  NetworkIcon,
  UserCogIcon,
  MoonIcon,
  ServerCogIcon,
  SunIcon,
  UsersIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth"

const NAV_MAIN = [
  { to: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { to: "/sites", label: "Sites", icon: GlobeIcon },
  { to: "/networks", label: "Networks", icon: NetworkIcon },
  { to: "/activity", label: "Activity", icon: ActivityIcon },
  { to: "/storage", label: "Backup Storage", icon: DatabaseIcon },
]

const NAV_ADMIN = [
  { to: "/users", label: "Users", icon: UsersIcon },
  { to: "/system", label: "System", icon: ServerCogIcon },
]

const THEME_KEY = "apod.theme"
let themeListeners: Array<() => void> = []

function readTheme(): "dark" | "light" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function useTheme() {
  const subscribe = useCallback((cb: () => void) => {
    themeListeners.push(cb)
    return () => {
      themeListeners = themeListeners.filter((l) => l !== cb)
    }
  }, [])
  const theme = useSyncExternalStore(subscribe, readTheme)
  const toggle = useCallback(() => {
    const next = readTheme() === "dark" ? "light" : "dark"
    document.documentElement.classList.toggle("dark", next === "dark")
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* ignore */
    }
    themeListeners.forEach((l) => l())
  }, [])
  return { theme, toggle }
}

function isActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/"
  return pathname === to || pathname.startsWith(to + "/")
}

export function AppLayout() {
  const { session, disconnect } = useAuth()
  const { theme, toggle } = useTheme()
  const location = useLocation()
  const isAdmin = session?.role === "admin"

  const serverHost = (() => {
    if (!session?.baseUrl) return "this server"
    try {
      return new URL(session.baseUrl).host
    } catch {
      return session.baseUrl
    }
  })()

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link to="/" />}
                className="data-[state=open]:bg-sidebar-accent"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="block size-4 rounded-full border-2 border-current" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5 leading-none">
                  <span className="font-heading font-semibold">apod</span>
                  <span className="truncate text-muted-foreground text-xs">
                    {serverHost}
                  </span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Hosting</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_MAIN.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={isActive(location.pathname, item.to)}
                      render={<Link to={item.to} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {isAdmin && (
            <SidebarGroup>
              <SidebarGroupLabel>Administration</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ADMIN.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        tooltip={item.label}
                        isActive={isActive(location.pathname, item.to)}
                        render={<Link to={item.to} />}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Profile & security"
                isActive={isActive(location.pathname, "/profile")}
                render={<Link to="/profile" />}
              >
                <UserCogIcon />
                <span>{session?.name ?? "Profile"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Disconnect" onClick={disconnect}>
                <LogOutIcon />
                <span>Disconnect</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="me-1 h-4!" />
          <span className="text-muted-foreground text-sm">
            {isAdmin ? "Administrator" : "User"} session
          </span>
          <div className="ms-auto flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Toggle theme"
                    onClick={toggle}
                  />
                }
              >
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </TooltipTrigger>
              <TooltipContent>
                Switch to {theme === "dark" ? "light" : "dark"} mode
              </TooltipContent>
            </Tooltip>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
