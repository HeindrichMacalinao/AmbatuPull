import type { Role } from "../../lib/types"
import Badge from "../ui/Badge"
import DataTable from "../ui/DataTable"
import ActionLinks from "./ActionLinks"

export default function SimpleHRTable({
  tab,
  role,
}: {
  tab: string
  role: Role
}) {
  const jobs = [
    { code: "J-001", name: "Software Engineer" },
    { code: "J-002", name: "Sales Manager" },
    { code: "J-003", name: "Operations Lead" },
  ]
  const depts = [
    { code: "D-001", name: "Engineering" },
    { code: "D-002", name: "Sales" },
    { code: "D-003", name: "Operations" },
  ]
  return (
    <DataTable
      columns={[
        { key: "code", label: tab === "Jobs" ? "Job code" : "Dept code" },
        {
          key: "name",
          label: tab === "Jobs" ? "Description / title" : "Department name",
        },
        ...(role !== "User" ? [{ key: "status", label: "Status" }] : []),
        { key: "actions", label: "Actions", align: "right" },
      ]}
      rows={(tab === "Jobs" ? jobs : depts).map((item) => ({
        ...item,
        code: <strong>{item.code}</strong>,
        status: <Badge>Active</Badge>,
        actions: <ActionLinks names={["Edit", "Delete"]} />,
      }))}
    />
  )
}
