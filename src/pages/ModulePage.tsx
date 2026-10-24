import { useState } from "react"
import Button from "../components/ui/Button"
import Icon from "../components/ui/Icon"
import CustomersTable from "../components/tables/CustomersTable"
import EmployeesTable from "../components/tables/EmployeesTable"
import ProductsTable from "../components/tables/ProductsTable"
import SalesTable from "../components/tables/SalesTable"
import SimpleHRTable from "../components/tables/SimpleHRTable"
import UsersTable from "../components/tables/UsersTable"
import type { Page, Role } from "../lib/types"

export const moduleMeta: Record<Exclude<Page, "Dashboard" | "Reports" | "Audit Log" | "System Settings">, {
  title: string
  subtitle: string
  action: string
}> = {
  Customers: {
    title: "Customer management",
    subtitle: "Manage customer records, payment terms, and account status.",
    action: "Add customer",
  },
  Products: {
    title: "Product management",
    subtitle: "Maintain your product catalog and effective price history.",
    action: "Add product",
  },
  "Human Resources": {
    title: "Human resources",
    subtitle: "Manage employees, jobs, departments, and career history.",
    action: "Add employee",
  },
  Sales: {
    title: "Sales management",
    subtitle: "Create transactions, manage line items, and record payments.",
    action: "New sale",
  },
  "User Management": {
    title: "User management",
    subtitle: "Manage accounts, assign roles, and set per-action rights.",
    action: "Add user",
  },
}

export default function ModulePage({
  page,
  role,
  openModal,
}: {
  page: keyof typeof moduleMeta
  role: Role
  openModal: () => void
}) {
  const meta = moduleMeta[page]
  const [hrTab, setHrTab] = useState("Employees")
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="page-title">{meta.title}</div>
          <div className="page-subtitle">{meta.subtitle}</div>
        </div>
        <Button icon="plus" onClick={openModal}>
          {meta.action}
        </Button>
      </section>
      {page === "Human Resources" && (
        <div className="tabs">
          <button
            className={hrTab === "Employees" ? "active" : ""}
            onClick={() => setHrTab("Employees")}
          >
            Employees <span>24</span>
          </button>
          <button
            className={hrTab === "Jobs" ? "active" : ""}
            onClick={() => setHrTab("Jobs")}
          >
            Jobs <span>8</span>
          </button>
          <button
            className={hrTab === "Departments" ? "active" : ""}
            onClick={() => setHrTab("Departments")}
          >
            Departments <span>6</span>
          </button>
        </div>
      )}
      <section className="card module-card">
        <div className="toolbar">
          <div className="search-box">
            <Icon name="search" size={17} />
            <input
              aria-label={`Search ${page}`}
              placeholder={`Search ${page.toLowerCase()}...`}
            />
          </div>
          <div className="toolbar-right">
            {role !== "User" && (
              <div className="status-tabs">
                <button className="active">Active</button>
                <button>Inactive</button>
                <button>All</button>
              </div>
            )}
            <Button variant="secondary" icon="filter">
              Filters
            </Button>
          </div>
        </div>
        {page === "Customers" && <CustomersTable role={role} />}
        {page === "Products" && <ProductsTable role={role} />}
        {page === "Human Resources" && hrTab === "Employees" && (
          <EmployeesTable role={role} />
        )}
        {page === "Human Resources" && hrTab !== "Employees" && (
          <SimpleHRTable tab={hrTab} role={role} />
        )}
        {page === "Sales" && <SalesTable role={role} />}
        {page === "User Management" && <UsersTable role={role} />}
      </section>
    </>
  )
}
