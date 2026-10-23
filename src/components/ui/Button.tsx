import type { ReactNode } from "react"
import type { IconName } from "../../lib/types"
import Icon from "./Icon"

export default function Button({
  children,
  variant = "primary",
  icon,
  onClick,
  disabled = false,
}: {
  children: ReactNode
  variant?: "primary" | "secondary" | "ghost" | "danger"
  icon?: IconName
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      className={`button button-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={16} />}
      <span>{children}</span>
    </button>
  )
}
