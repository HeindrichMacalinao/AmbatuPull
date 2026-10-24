import { nav } from "../lib/navigation"
import type { Page, Role } from "../lib/types"
import Icon from "../components/ui/Icon"

export default function Sidebar({
  page,
  role,
  onNavigate,
}: {
  page: Page
  role: Role
  onNavigate: (page: Page) => void
}) {
  const visible = nav.filter(
    (item) => !item.restricted || item.restricted.includes(role),
  )
  const groups = Array.from(new Set(visible.map((item) => item.group)))
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">H</div>
        <div>
          <div className="brand-name">Hope, Inc.</div>
          <div className="brand-sub">Enterprise resource planning</div>
        </div>
      </div>
      <nav className="nav">
        {groups.map((group) => (
          <div className="nav-group" key={group}>
            <div className="nav-label">{group}</div>
            {visible
              .filter((item) => item.group === group)
              .map((item) => (
                <button
                  key={item.label}
                  className={`nav-item ${page === item.label ? "active" : ""}`}
                  onClick={() => onNavigate(item.label)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.label === "Sales" && (
                    <span className="nav-count">8</span>
                  )}
                </button>
              ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-help">
        <div className="help-icon">
          <Icon name="building" size={17} />
        </div>
        <div>
          <strong>Need assistance?</strong>
          <span>View ERP student guide</span>
        </div>
        <Icon name="chevron" size={14} />
      </div>
      <div className="sidebar-profile">
        <div className="avatar">LP</div>
        <div>
          <strong>Lisa Park</strong>
          <span>admin@hope.com</span>
        </div>
        <Icon name="more" />
      </div>
    </aside>
  )
}
