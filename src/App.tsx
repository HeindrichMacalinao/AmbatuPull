import { useMemo, useState } from "react"
import AddModal from "./components/AddModal"
import Sidebar from "./layouts/Sidebar"
import Topbar from "./layouts/Topbar"
import { nav } from "./lib/navigation"
import type { Page, Role } from "./lib/types"
import AuditPage from "./pages/AuditPage"
import Dashboard from "./pages/Dashboard"
import LoginPage from "./pages/LoginPage"
import ModulePage, { moduleMeta } from "./pages/ModulePage"
import ReportsPage from "./pages/ReportsPage"
import SettingsPage from "./pages/SettingsPage"

export default function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [role, setRole] = useState<Role>("Superadmin")
  const [page, setPage] = useState<Page>("Dashboard")
  const [modalOpen, setModalOpen] = useState(false)

  const allowedPage = useMemo(() => {
    const item = nav.find((entry) => entry.label === page)
    return !item?.restricted || item.restricted.includes(role)
      ? page
      : "Dashboard"
  }, [page, role])

  if (!authenticated) {
    return <LoginPage onSignIn={() => setAuthenticated(true)} />
  }

  return (
    <div className="app-shell">
      <Sidebar page={allowedPage} role={role} onNavigate={setPage} />
      <div className="app-main">
        <Topbar page={allowedPage} role={role} setRole={setRole} />
        <main className="content">
          {allowedPage === "Dashboard" && (
            <Dashboard role={role} onNavigate={setPage} />
          )}
          {allowedPage in moduleMeta && (
            <ModulePage
              page={allowedPage as keyof typeof moduleMeta}
              role={role}
              openModal={() => setModalOpen(true)}
            />
          )}
          {allowedPage === "Reports" && <ReportsPage />}
          {allowedPage === "Audit Log" && <AuditPage />}
          {allowedPage === "System Settings" && <SettingsPage />}
        </main>
      </div>
      {modalOpen && (
        <AddModal page={allowedPage} onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}
