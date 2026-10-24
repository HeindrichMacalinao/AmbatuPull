import type { ReactNode } from "react"
import Button from "./Button"

export type TableColumn = { key: string label: string align?: "right" }
export type TableRow = Record<string, ReactNode> & { deleted?: boolean }

export default function DataTable({
  columns,
  rows,
}: {
  columns: TableColumn[]
  rows: TableRow[]
}) {
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
          {rows.map((row, index) => (
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
          Showing <strong>1–{rows.length}</strong> of{" "}
          <strong>{rows.length}</strong> records
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
