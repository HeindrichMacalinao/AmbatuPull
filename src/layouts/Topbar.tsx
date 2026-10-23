import type { Page, Role } from "../lib/types"
import Icon from "../components/ui/Icon"

export default function Topbar({
  page,
  role,
  setRole,
}: {
  page: Page
  role: Role
  setRole: (role: Role) => void
}) {
  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <span>Hope ERP</span>
        <Icon name="chevron" size={13} />
        <strong>{page}</strong>
      </div>
      <div className="top-actions">
        <label className="role-switch">
          <span>Viewing as</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            <option>Superadmin</option>
            <option>Admin</option>
            <option>User</option>
          </select>
        </label>
        <button className="icon-button" aria-label="Notifications">
          <Icon name="bell" />
          <span className="notification-dot" />
        </button>
        <div className="top-avatar">LP</div>
      </div>
    </header>
  )
}
