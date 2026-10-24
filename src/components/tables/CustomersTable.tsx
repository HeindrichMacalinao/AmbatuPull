import type { Role } from "../../lib/types"
import Badge from "../ui/Badge"
import DataTable, {
  type StatusCounts,
  type StatusFilter,
  type TableColumn,
  type TableRow,
} from "../ui/DataTable"
import ActionLinks from "./ActionLinks"

export default function CustomersTable({
  role,
  statusFilter,
  onStatusCountsChange,
}: {
  role: Role
  statusFilter: StatusFilter
  onStatusCountsChange: (counts: StatusCounts) => void
}) {
  const admin = role !== "User"
  const columns: TableColumn[] = [
    { key: "id", label: "Cust no" },
    { key: "name", label: "Customer name" },
    { key: "address", label: "Address" },
    { key: "terms", label: "Pay terms" },
    ...(admin
      ? [
          { key: "status", label: "Status" },
          { key: "stamp", label: "Stamp" },
        ]
      : []),
    { key: "actions", label: "Actions", align: "right" },
  ]
  const rows: TableRow[] = [
    {
      statusCategory: "active",
      id: <strong>C-001</strong>,
      name: "Acme Corporation",
      address: "123 Main St., Metro City",
      terms: "Net 30",
      status: <Badge>Active</Badge>,
      stamp: <span className="stamp">CREATED · system · Oct 01</span>,
      actions: <ActionLinks names={["Edit", ...(admin ? ["Delete"] : [])]} />,
    },
    {
      statusCategory: "active",
      id: <strong>C-002</strong>,
      name: "Globex Industries",
      address: "456 Oak Ave., Harbor Town",
      terms: "Net 45",
      status: <Badge>Active</Badge>,
      stamp: <span className="stamp">CREATED · system · Oct 02</span>,
      actions: <ActionLinks names={["Edit", ...(admin ? ["Delete"] : [])]} />,
    },
    {
      statusCategory: "active",
      id: <strong>C-003</strong>,
      name: "Initech LLC",
      address: "88 Market Rd., Westhaven",
      terms: "COD",
      status: <Badge>Active</Badge>,
      stamp: <span className="stamp">EDITED · admin1 · Oct 09</span>,
      actions: <ActionLinks names={["Edit", ...(admin ? ["Delete"] : [])]} />,
    },
    ...(admin
      ? [
          {
            statusCategory: "inactive",
            id: <strong>C-004</strong>,
            name: "Umbrella Corp",
            address: "1 Raccoon City Blvd",
            terms: "Prepaid",
            status: <Badge tone="red">Inactive</Badge>,
            stamp: <span className="stamp">DELETED · user2 · Oct 13</span>,
            actions: <ActionLinks names={["Restore"]} />,
            deleted: true,
          },
        ]
      : []),
  ]
  return (
    <DataTable
      columns={columns}
      rows={rows}
      statusFilter={statusFilter}
      onStatusCountsChange={onStatusCountsChange}
    />
  )
}
