import Badge from "../components/ui/Badge"
import Button from "../components/ui/Button"
import DataTable from "../components/ui/DataTable"
import Icon from "../components/ui/Icon"

export default function AuditPage() {
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="page-title">Audit log</div>
          <div className="page-subtitle">
            Review immutable system activity and record-level changes.
          </div>
        </div>
        <Button variant="secondary" icon="download">
          Export CSV
        </Button>
      </section>
      <section className="card module-card">
        <div className="toolbar">
          <div className="search-box">
            <Icon name="search" size={17} />
            <input placeholder="Search audit events..." />
          </div>
          <div className="toolbar-right">
            <Button variant="secondary" icon="filter">
              Oct 01 — Oct 31
            </Button>
            <Button variant="secondary">All actions</Button>
          </div>
        </div>
        <DataTable
          columns={[
            { key: "time", label: "Timestamp" },
            { key: "user", label: "User" },
            { key: "record", label: "Module / record" },
            { key: "action", label: "Action taken" },
            { key: "detail", label: "Stamp details" },
          ]}
          rows={[
            {
              time: "Oct 13, 2026 · 1:05 PM",
              user: <strong>superadmin</strong>,
              record: "User · Alex Rivera",
              action: <Badge tone="blue">Rights update</Badge>,
              detail: (
                <span className="stamp">
                  CHANGED_RIGHTS · superadmin · 13:05
                </span>
              ),
            },
            {
              time: "Oct 13, 2026 · 1:01 PM",
              user: <strong>admin1</strong>,
              record: "Customer · C-004",
              action: <Badge tone="red">Soft delete</Badge>,
              detail: <span className="stamp">DELETED · user2 · 13:01</span>,
            },
            {
              time: "Oct 12, 2026 · 4:42 PM",
              user: <strong>admin1</strong>,
              record: "Product · P-003",
              action: <Badge tone="amber">Edited</Badge>,
              detail: <span className="stamp">EDITED · admin1 · 16:42</span>,
            },
          ]}
        />
      </section>
    </>
  )
}
