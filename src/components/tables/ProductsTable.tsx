import type { Role } from "../../lib/types"
import Badge from "../ui/Badge"
import DataTable from "../ui/DataTable"
import ActionLinks from "./ActionLinks"

export default function ProductsTable({ role }: { role: Role }) {
  const admin = role !== "User"
  return (
    <DataTable
      columns={[
        { key: "code", label: "Prod code" },
        { key: "description", label: "Description" },
        { key: "unit", label: "Unit" },
        { key: "price", label: "Current price", align: "right" },
        ...(admin
          ? [
              { key: "status", label: "Status" },
              { key: "stamp", label: "Stamp" },
            ]
          : []),
        { key: "actions", label: "Actions", align: "right" },
      ]}
      rows={[
        {
          code: <strong>P-001</strong>,
          description: "Industrial Widget A",
          unit: "pcs",
          price: <strong>$13.75</strong>,
          status: <Badge>Active</Badge>,
          stamp: <span className="stamp">CREATED · system · Oct 01</span>,
          actions: (
            <ActionLinks
              names={["Prices", "Edit", ...(admin ? ["Delete"] : [])]}
            />
          ),
        },
        {
          code: <strong>P-002</strong>,
          description: "Steel Bracket Heavy",
          unit: "pcs",
          price: <strong>$48.50</strong>,
          status: <Badge>Active</Badge>,
          stamp: <span className="stamp">CREATED · system · Oct 02</span>,
          actions: (
            <ActionLinks
              names={["Prices", "Edit", ...(admin ? ["Delete"] : [])]}
            />
          ),
        },
        {
          code: <strong>P-003</strong>,
          description: "Premium Sealant",
          unit: "can",
          price: <strong>$22.00</strong>,
          status: <Badge>Active</Badge>,
          stamp: <span className="stamp">EDITED · admin1 · Oct 08</span>,
          actions: (
            <ActionLinks
              names={["Prices", "Edit", ...(admin ? ["Delete"] : [])]}
            />
          ),
        },
        ...(admin
          ? [
              {
                code: <strong>P-004</strong>,
                description: "Safety Gloves XL",
                unit: "pair",
                price: "—",
                status: <Badge tone="red">Inactive</Badge>,
                stamp: <span className="stamp">DELETED · user2 · Oct 12</span>,
                actions: <ActionLinks names={["Restore"]} />,
                deleted: true,
              },
            ]
          : []),
      ]}
    />
  )
}
