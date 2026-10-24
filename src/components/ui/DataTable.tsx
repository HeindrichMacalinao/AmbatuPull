import { useEffect, type ReactNode } from "react"
import Button from "./Button"

export type TableColumn = { key: string; label: string; align?: "right" }
export type StatusFilter = "Active" | "Inactive" | "All"
export type StatusCounts = { active: number; inactive: number; all: number }
export type TableRow = Record<string, ReactNode> & {
  deleted?: boolean
  statusCategory?: "active" | "inactive" | "other"
}

export default function DataTable({
  columns,
  rows,
  statusFilter = "All",
  onStatusCountsChange,
}: {
  columns: TableColumn[]
  rows: TableRow[]
  statusFilter?: StatusFilter
  onStatusCountsChange?: (counts: StatusCounts) => void
}) {
  const counts = rows.reduce<StatusCounts>(
    (current, row) => {
      if (row.statusCategory === "active") current.active += 1
      if (row.statusCategory === "inactive") current.inactive += 1
      current.all += 1
      return current
    },
    { active: 0, inactive: 0, all: 0 },
  )
  useEffect(() => {
    onStatusCountsChange?.(counts)
  }, [counts.active, counts.inactive, counts.all, onStatusCountsChange])
  const filteredRows =
    statusFilter === "All"
      ? rows
      : rows.filter((row) => row.statusCategory === statusFilter.toLowerCase())

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                className={column.align === "right" ? "align-right" : ""}
                key={column.key}
              >
                {column.label}
                <span className="sort">↕</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row, index) => (
            <tr key={index} className={row.deleted ? "deleted-row" : ""}>
              {columns.map((column) => (
                <td
                  className={column.align === "right" ? "align-right" : ""}
                  key={column.key}
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        <span>
          Showing <strong>1–{filteredRows.length}</strong> of{" "}
          <strong>{filteredRows.length}</strong> records
        </span>
        <div>
          <Button variant="secondary" disabled>
            Previous
          </Button>
          <button className="page-number active">1</button>
          <Button variant="secondary">Next</Button>
        </div>
      </div>
    </div>
  )
}
