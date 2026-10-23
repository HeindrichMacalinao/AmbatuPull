import type { IconName, Page, Role } from "../lib/types"
import Badge from "../components/ui/Badge"
import Button from "../components/ui/Button"
import Icon from "../components/ui/Icon"

const summary = [
  {
    label: "Total customers",
    value: "1,248",
    note: "12% from last month",
    icon: "users" as IconName,
    tone: "blue",
  },
  {
    label: "Total products",
    value: "386",
    note: "12 low stock",
    icon: "box" as IconName,
    tone: "violet",
  },
  {
    label: "Open sales",
    value: "94",
    note: "18 pending delivery",
    icon: "receipt" as IconName,
    tone: "amber",
  },
  {
    label: "Total revenue",
    value: "$84.2k",
    note: "8.4% year to date",
    icon: "chart" as IconName,
    tone: "green",
  },
]

const activity = [
  {
    initials: "LP",
    color: "blue",
    title: "Lisa Park added a new customer",
    detail: "C-1248 · Northstar Manufacturing",
    time: "12 min ago",
  },
  {
    initials: "AR",
    color: "violet",
    title: "Alex Rivera recorded a sale",
    detail: "T-0084 · $1,245.00",
    time: "36 min ago",
  },
  {
    initials: "MS",
    color: "green",
    title: "Maria Santos updated a product",
    detail: "P-0386 · Industrial valve",
    time: "1 hr ago",
  },
  {
    initials: "JD",
    color: "amber",
    title: "Juan Reyes added a payment",
    detail: "OR-1001 · $150.00",
    time: "2 hrs ago",
  },
]

function MetricCard({ item }: { item: typeof summary[number] }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon metric-${item.tone}`}>
        <Icon name={item.icon} />
      </div>
      <div className="metric-top">
        <span>{item.label}</span>
        <button className="subtle-icon">
          <Icon name="more" size={17} />
        </button>
      </div>
      <div className="metric-value">{item.value}</div>
      <div className="metric-note">
        <span className={item.tone === "amber" ? "warning-text" : "positive"}>
          {item.tone !== "amber" && <Icon name="arrowUp" size={12} />}
          {item.note}
        </span>
      </div>
    </div>
  )
}

export default function Dashboard({
  role,
  onNavigate,
}: {
  role: Role
  onNavigate: (page: Page) => void
}) {
  const actions: {
    label: string
    detail: string
    icon: IconName
    page: Page
    denied?: boolean
  }[] = [
    {
      label: "Add customer",
      detail: "Create a customer record",
      icon: "customer",
      page: "Customers",
    },
    {
      label: "Add product",
      detail: "Add to product master",
      icon: "box",
      page: "Products",
    },
    {
      label: "Create sale",
      detail: "Record a new transaction",
      icon: "receipt",
      page: "Sales",
    },
    {
      label: "Add employee",
      detail: role === "User" ? "Permission required" : "Create an HR profile",
      icon: "briefcase",
      page: "Human Resources",
      denied: role === "User",
    },
  ]
  return (
    <>
      <section className="welcome">
        <div>
          <div className="eyebrow">{role} workspace</div>
          <div className="page-title">Good morning, Lisa</div>
          <div className="page-subtitle">
            Here’s what’s happening across Hope, Inc. today.
          </div>
        </div>
        <div className="date-chip">
          <span>Reporting period</span>
          <strong>Oct 01 — Oct 31, 2026</strong>
          <Icon name="chevron" size={14} />
        </div>
      </section>
      <section className="metrics">
        {summary.map((item) => (
          <MetricCard item={item} key={item.label} />
        ))}
      </section>
      <section className="dashboard-grid">
        <div className="card chart-card">
          <div className="card-head">
            <div>
              <div className="card-title">Revenue overview</div>
              <div className="card-subtitle">Monthly net sales performance</div>
            </div>
            <div className="legend">
              <span>
                <i className="legend-current" />
                2026
              </span>
              <span>
                <i />
                2025
              </span>
            </div>
          </div>
          <div className="chart-summary">
            <div>
              <span>October revenue</span>
              <strong>$84,240</strong>
            </div>
            <Badge tone="green">+8.4% YoY</Badge>
          </div>
          <div className="chart-area">
            <div className="y-labels">
              <span>$100k</span>
              <span>$75k</span>
              <span>$50k</span>
              <span>$25k</span>
              <span>$0</span>
            </div>
            <div className="plot">
              <div className="grid-line l1" />
              <div className="grid-line l2" />
              <div className="grid-line l3" />
              <div className="grid-line l4" />
              <svg
                viewBox="0 0 640 220"
                preserveAspectRatio="none"
                className="chart-svg"
              >
                <path
                  className="area-path"
                  d="M0,186 C35,177 65,168 93,174 C125,180 155,134 190,142 C225,150 252,116 286,125 C323,134 348,94 382,104 C420,115 450,75 478,87 C520,103 546,46 575,60 C603,73 620,34 640,28 L640,220 L0,220 Z"
                />
                <path
                  className="line-previous"
                  d="M0,198 C45,184 68,183 95,186 C135,190 160,158 190,164 C230,171 251,147 286,149 C326,151 355,127 383,135 C421,146 451,109 480,116 C525,126 549,94 580,105 C610,113 626,84 640,80"
                />
                <path
                  className="line-current"
                  d="M0,186 C35,177 65,168 93,174 C125,180 155,134 190,142 C225,150 252,116 286,125 C323,134 348,94 382,104 C420,115 450,75 478,87 C520,103 546,46 575,60 C603,73 620,34 640,28"
                />
                <circle cx="640" cy="28" r="5" />
              </svg>
              <div className="x-labels">
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
                <span>Sep</span>
                <span>Oct</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card activity-card">
          <div className="card-head">
            <div>
              <div className="card-title">Recent activity</div>
              <div className="card-subtitle">Latest updates across modules</div>
            </div>
            <Button variant="ghost">View all</Button>
          </div>
          <div className="activity-list">
            {activity.map((item) => (
              <div className="activity-item" key={item.title}>
                <div className={`activity-avatar avatar-${item.color}`}>
                  {item.initials}
                </div>
                <div className="activity-copy">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <time>{item.time}</time>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="card quick-card">
        <div className="card-head">
          <div>
            <div className="card-title">Quick actions</div>
            <div className="card-subtitle">
              Jump straight into common workflows
            </div>
          </div>
        </div>
        <div className="quick-grid">
          {actions.map((action) => (
            <button
              disabled={action.denied}
              onClick={() => onNavigate(action.page)}
              className="quick-action"
              key={action.label}
            >
              <div className="quick-icon">
                <Icon name={action.icon} />
              </div>
              <div>
                <strong>{action.label}</strong>
                <span>{action.detail}</span>
              </div>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
