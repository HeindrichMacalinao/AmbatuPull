import type { IconName, Page, Role } from "./types"

export const nav: {
  label: Page
  icon: IconName
  group: string
  restricted?: Role[]
}[] = [
  { label: "Dashboard", icon: "grid", group: "Workspace" },
  { label: "Customers", icon: "users", group: "Operations" },
  { label: "Products", icon: "box", group: "Operations" },
  { label: "Human Resources", icon: "briefcase", group: "Operations" },
  { label: "Sales", icon: "receipt", group: "Operations" },
  { label: "Reports", icon: "chart", group: "Insights" },
  {
    label: "User Management",
    icon: "shield",
    group: "Administration",
    restricted: ["Superadmin", "Admin"],
  },
  {
    label: "Audit Log",
    icon: "history",
    group: "Administration",
    restricted: ["Superadmin"],
  },
  {
    label: "System Settings",
    icon: "settings",
    group: "Administration",
    restricted: ["Superadmin"],
  },
]
