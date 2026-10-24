import type { Page } from "../lib/types"
import Button from "./ui/Button"
import Icon from "./ui/Icon"

export default function AddModal({
  page,
  onClose,
}: {
  page: Page
  onClose: () => void
}) {
  const title =
    page === "Sales"
      ? "Create new sale"
      : page === "User Management"
        ? "Add user account"
        : `Add ${
            page === "Human Resources"
              ? "employee"
              : page.slice(0, -1).toLowerCase()
          }`
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            <div className="card-subtitle">
              Enter the details below. Required fields are marked.
            </div>
          </div>
          <button className="icon-button" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">
          <div className="notice">
            <Icon name="check" />
            <div>
              <strong>Record controls</strong>
              <span>
                Identifiers are generated automatically and audit stamps are
                recorded on save.
              </span>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Record number</span>
              <input disabled value="Auto-generated" readOnly />
            </label>
            <label>
              <span>Status</span>
              <select defaultValue="Active">
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </label>
            <label className="span-two">
              <span>
                {page === "Products"
                  ? "Product description"
                  : page === "User Management"
                    ? "Email address"
                    : "Name"}{" "}
                *
              </span>
              <input autoFocus placeholder="Enter a value" />
            </label>
            <label className="span-two">
              <span>Additional details</span>
              <textarea
                placeholder="Enter supporting information..."
                rows={3}
              />
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Save record</Button>
        </div>
      </div>
    </div>
  )
}
