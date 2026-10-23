import type { Role } from "../../lib/types"
import Badge from "../ui/Badge"
import DataTable from "../ui/DataTable"
import ActionLinks from "./ActionLinks"

export default function UsersTable({ role }: { role: Role }) {
  return (
    <DataTable
      columns={[
        { key: "id", label: "User ID" },
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "role", label: "Role" },
        { key: "status", label: "Account status" },
        { key: "actions", label: "Actions", align: "right" },
      ]}
      rows={[
        {
          id: "USR-001",
          name: (
            <div className="person-cell">
              <span className="mini-avatar">LP</span>
              <strong>Lisa Park</strong>
            </div>
          ),
          email: "admin@hope.com",
          role: <Badge tone="blue">Admin</Badge>,
          status: <Badge>Active</Badge>,
          actions: <span className="muted">Protected account</span>,
        },
        {
          id: "USR-002",
          name: (
            <div className="person-cell">
              <span className="mini-avatar">AR</span>
              <strong>Alex Rivera</strong>
            </div>
          ),
          email: "user@hope.com",
          role: <Badge tone="gray">User</Badge>,
          status: <Badge>Active</Badge>,
          actions: <ActionLinks names={["Rights", "Edit", "Block"]} />,
        },
        {
          id: "USR-003",
          name: (
            <div className="person-cell">
              <span className="mini-avatar">JD</span>
              <strong>John Doe</strong>
            </div>
          ),
          email: "john@hope.com",
          role: <Badge tone="gray">User</Badge>,
          status: <Badge tone="red">Blocked</Badge>,
          actions: <ActionLinks names={["Rights", "Edit", "Unblock"]} />,
        },
        ...(role === "Superadmin"
          ? [
              {
                id: "USR-004",
                name: "System Owner",
                email: "owner@hope.com",
                role: <Badge tone="blue">Superadmin</Badge>,
                status: <Badge>Active</Badge>,
                actions: <ActionLinks names={["Edit"]} />,
              },
            ]
          : []),
      ]}
    />
  )
}
