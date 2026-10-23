import Button from "../components/ui/Button"
import Icon from "../components/ui/Icon"

export default function SettingsPage() {
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="page-title">System settings</div>
          <div className="page-subtitle">
            Configure organization-wide defaults and business rules.
          </div>
        </div>
        <Button>Save changes</Button>
      </section>
      <section className="settings-grid">
        {[
          "Company profile",
          "Sales defaults",
          "Regional settings",
          "Security policy",
        ].map((item, index) => (
          <div className="card settings-card" key={item}>
            <div className="settings-icon">
              <Icon
                name={
                  index === 0 ? "building" : index === 3 ? "shield" : "settings"
                }
              />
            </div>
            <div>
              <div className="card-title">{item}</div>
              <div className="card-subtitle">
                {index === 0
                  ? "Legal name, address, and company details"
                  : index === 1
                    ? "Payment terms, currency, and tax rules"
                    : index === 2
                      ? "Time zone, date, and number formats"
                      : "Password requirements and session limits"}
              </div>
            </div>
            <Icon name="chevron" />
          </div>
        ))}
      </section>
    </>
  )
}
