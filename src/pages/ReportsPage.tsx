import { useState } from "react"
import Button from "../components/ui/Button"
import DataTable from "../components/ui/DataTable"

const reports = [
  "Top customers",
  "Product master",
  "Top products",
  "Active employees",
  "All employees",
  "Job history",
  "Top sales",
]

export default function ReportsPage() {
  const [report, setReport] = useState("Top customers")
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">
            Analyze performance across sales, products, customers, and people.
          </div>
        </div>
        <Button icon="download">Save as PDF</Button>
      </section>
      <div className="report-tabs">
        {reports.map((item) => (
          <button
            className={item === report ? "active" : ""}
            onClick={() => setReport(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      <section className="card report-card">
        <div className="report-header">
          <div>
            <div className="card-title">
              {report === "Top customers" ? "Top customers by sales" : report}
            </div>
            <div className="card-subtitle">
              October 1–31, 2026 · Accrual basis
            </div>
          </div>
          <div className="report-filters">
            <label>
              From
              <input type="date" defaultValue="2026-10-01" />
            </label>
            <label>
              To
              <input type="date" defaultValue="2026-10-31" />
            </label>
            <label>
              Top
              <select defaultValue="10">
                <option>10</option>
                <option>25</option>
                <option>50</option>
              </select>
            </label>
            <Button variant="secondary">Print</Button>
          </div>
        </div>
        <DataTable
          columns={[
            { key: "rank", label: "Rank" },
            { key: "id", label: "Cust no" },
            { key: "name", label: "Customer name" },
            { key: "sales", label: "Total sales", align: "right" },
          ]}
          rows={[
            {
              rank: <span className="rank rank-one">1</span>,
              id: "C-003",
              name: <strong>Initech LLC</strong>,
              sales: <strong>$510.00</strong>,
            },
            {
              rank: <span className="rank">2</span>,
              id: "C-001",
              name: <strong>Acme Corporation</strong>,
              sales: <strong>$234.50</strong>,
            },
            {
              rank: <span className="rank">3</span>,
              id: "C-002",
              name: <strong>Globex Industries</strong>,
              sales: <strong>$140.00</strong>,
            },
          ]}
        />
        <div className="report-total">
          <span>Report total</span>
          <strong>$884.50</strong>
        </div>
      </section>
    </>
  )
}
