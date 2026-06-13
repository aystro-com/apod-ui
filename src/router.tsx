/* eslint-disable react-refresh/only-export-components -- route definitions and helpers live together by design */
import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
} from "@tanstack/react-router"
import { AppLayout } from "@/components/app-layout"
import { useAuth } from "@/lib/auth"
import { ActivityPage } from "@/pages/activity"
import { DashboardPage } from "@/pages/dashboard"
import { SiteCreatePage } from "@/pages/site-create"
import { SiteDetailPage } from "@/pages/site-detail"
import { ProfilePage } from "@/pages/profile"
import { SitesPage } from "@/pages/sites"
import { StoragePage } from "@/pages/storage"
import { SystemPage } from "@/pages/system"
import { UsersPage } from "@/pages/users"
import type { ReactNode } from "react"

// Renders admin-only pages, bouncing non-admin users back to the dashboard.
// UX only — the apod server enforces the admin role on every endpoint.
function AdminOnly({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  if (session?.role !== "admin") return <Navigate to="/" replace />
  return children
}

const rootRoute = createRootRoute({
  component: AppLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
})

const sitesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sites",
  component: SitesPage,
})

const siteCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sites/new",
  component: SiteCreatePage,
})

const siteDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sites/$domain",
  component: SiteDetailPage,
})

// Same page handles tab sub-paths like /sites/example.com/backups.
const siteDetailTabRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sites/$domain/$",
  component: SiteDetailPage,
})

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity",
  component: ActivityPage,
})

const storageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/storage",
  component: StoragePage,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: ProfilePage,
})

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users",
  component: () => (
    <AdminOnly>
      <UsersPage />
    </AdminOnly>
  ),
})

const systemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/system",
  component: () => (
    <AdminOnly>
      <SystemPage />
    </AdminOnly>
  ),
})

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  sitesRoute,
  siteCreateRoute,
  siteDetailRoute,
  siteDetailTabRoute,
  activityRoute,
  storageRoute,
  profileRoute,
  usersRoute,
  systemRoute,
])

export function createAppRouter() {
  return createRouter({
    routeTree,
    defaultNotFoundComponent: () => <Navigate to="/" replace />,
  })
}
