import type { Role } from "../../lib/types"
import Badge from "../ui/Badge"
import DataTable, {
  type StatusCounts,
  type StatusFilter,
} from "../ui/DataTable"
import ActionLinks from "./ActionLinks"

export default function SalesTable({
  role,
  statusFilter,
  onStatusCountsChange,
}: {
  role: Role
  statusFilter: StatusFilter
  onStatusCountsChange: (counts: StatusCounts) => void
}) {
  const admin = role !== "User"
  return (
    <DataTable
      columns={[
        { key: "id", label: "Trans no" },
        { key: "date", label: "Sales date" },
        { key: "customer", label: "Customer" },
        { key: "employee", label: "Employee" },
        { key: "total", label: "Total", align: "right" },
        ...(admin ? [{ key: "status", label: "Status" }] : []),
        { key: "actions", label: "Actions", align: "right" },
      ]}
      rows={[
        {
          statusCategory: "active",
          id: <strong>T-001</strong>,
          date: "Oct 01, 2026",
          customer: "C-001 · Acme Corporation",
          employee: "E-002 · Juan Reyes",
          total: <strong>$234.50</strong>,
          status: <Badge>Active</Badge>,
          actions: <ActionLinks names={["Details", "Payments", "Edit"]} />,
        },
        {
          statusCategory: "active",
          id: <strong>T-002</strong>,
          date: "Oct 05, 2026",
          customer: "C-003 · Initech LLC",
          employee: "E-002 · Juan Reyes",
          total: <strong>$510.00</strong>,
          status: <Badge>Active</Badge>,
          actions: <ActionLinks names={["Details", "Payments", "Edit"]} />,
        },
        {
          statusCategory: "other",
          id: <strong>T-003</strong>,
          date: "Oct 09, 2026",
          customer: "C-002 · Globex Industries",
          employee: "E-003 · Anna Cruz",
          total: <strong>$140.00</strong>,
          status: <Badge tone="amber">Pending</Badge>,
          actions: <ActionLinks names={["Details", "Payments", "Edit"]} />,
        },
      ]}
      statusFilter={statusFilter}
      onStatusCountsChange={onStatusCountsChange}
    />
  )
}
