import type { Role } from "../../lib/types"
import Badge from "../ui/Badge"
import DataTable from "../ui/DataTable"
import ActionLinks from "./ActionLinks"

export default function EmployeesTable({ role }: { role: Role }) {
  const admin = role !== "User"
  return (
    <DataTable
      columns={[
        { key: "id", label: "Emp no" },
        { key: "name", label: "Employee" },
        { key: "gender", label: "Gender" },
        { key: "hire", label: "Hire date" },
        { key: "job", label: "Current job" },
        ...(admin ? [{ key: "status", label: "Status" }] : []),
        { key: "actions", label: "Actions", align: "right" },
      ]}
      rows={[
        {
          id: <strong>E-001</strong>,
          name: (
            <div className="person-cell">
              <span className="mini-avatar">MS</span>
              <span>
                <strong>Maria Santos</strong>
                <small>Engineering</small>
              </span>
            </div>
          ),
          gender: "F",
          hire: "Mar 01, 2020",
          job: "Software Engineer",
          status: <Badge>Active</Badge>,
          actions: <ActionLinks names={["Profile", "History", "Edit"]} />,
        },
        {
          id: <strong>E-002</strong>,
          name: (
            <div className="person-cell">
              <span className="mini-avatar">JR</span>
              <span>
                <strong>Juan Reyes</strong>
                <small>Sales</small>
              </span>
            </div>
          ),
          gender: "M",
          hire: "Jul 15, 2019",
          job: "Sales Manager",
          status: <Badge>Active</Badge>,
          actions: <ActionLinks names={["Profile", "History", "Edit"]} />,
        },
        {
          id: <strong>E-003</strong>,
          name: (
            <div className="person-cell">
              <span className="mini-avatar">AC</span>
              <span>
                <strong>Anna Cruz</strong>
                <small>Operations</small>
              </span>
            </div>
          ),
          gender: "F",
          hire: "Jan 20, 2022",
          job: "Operations Lead",
          status: <Badge>Active</Badge>,
          actions: <ActionLinks names={["Profile", "History", "Edit"]} />,
        },
        ...(admin
          ? [
              {
                id: <strong>E-004</strong>,
                name: "Pedro Garcia",
                gender: "M",
                hire: "May 01, 2018",
                job: "Finance Analyst",
                status: <Badge tone="red">Inactive</Badge>,
                actions: <ActionLinks names={["Restore"]} />,
                deleted: true,
              },
            ]
          : []),
      ]}
    />
  )
}
