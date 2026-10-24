import { useState, type FormEvent } from "react"
import Icon from "../components/ui/Icon"

type LoginAlert = "invalid" | "blocked" | null

export default function LoginPage({ onSignIn }: { onSignIn: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [alert, setAlert] = useState<LoginAlert>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (email.toLowerCase().includes("blocked")) {
      setAlert("blocked")
      return
    }

    if (!email.includes("@") || password.length < 6) {
      setAlert("invalid")
      return
    }

    setAlert(null)
    onSignIn()
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand">
          <div className="login-brand-mark">H</div>
          <div>
            <strong>Hope, Inc.</strong>
            <span>Enterprise resource planning</span>
          </div>
        </div>

        <div className="login-story-copy">
          <div className="login-kicker">One connected workspace</div>
          <div className="login-story-title">
            Run your entire business with confidence.
          </div>
          <div className="login-story-subtitle">
            Bring customers, products, people, and sales together in one secure
            system built for growing teams.
          </div>

          <div className="login-proof-grid">
            <div>
              <Icon name="chart" size={19} />
              <strong>Live visibility</strong>
              <span>Make decisions with current operational data.</span>
            </div>
            <div>
              <Icon name="shield" size={19} />
              <strong>Role-based control</strong>
              <span>Keep every workflow secure and accountable.</span>
            </div>
          </div>
        </div>

        <div className="login-preview">
          <div className="preview-bar">
            <div className="preview-dots">
              <i />
              <i />
              <i />
            </div>
            <span>Executive overview</span>
            <BadgePreview />
          </div>
          <div className="preview-body">
            <div className="preview-nav">
              <i className="active" />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="preview-content">
              <div className="preview-heading">
                <div>
                  <i />
                  <i />
                </div>
                <span />
              </div>
              <div className="preview-metrics">
                <PreviewMetric value="1,248" label="Customers" />
                <PreviewMetric value="386" label="Products" />
                <PreviewMetric value="$84.2k" label="Revenue" />
              </div>
              <div className="preview-chart">
                <div className="preview-chart-label">Revenue performance</div>
                <svg viewBox="0 0 430 100" preserveAspectRatio="none">
                  <path
                    className="preview-area"
                    d="M0 87 C40 80 48 67 85 72 C120 77 130 50 170 57 C210 64 218 37 255 45 C300 55 315 26 345 34 C380 42 392 16 430 10 L430 100 L0 100Z"
                  />
                  <path
                    className="preview-line"
                    d="M0 87 C40 80 48 67 85 72 C120 77 130 50 170 57 C210 64 218 37 255 45 C300 55 315 26 345 34 C380 42 392 16 430 10"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="login-story-footer">
          <span>© 2026 Hope, Inc.</span>
          <span>Privacy</span>
          <span>Support</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-form-shell">
          <div className="login-mobile-brand">
            <div className="login-brand-mark">H</div>
            <strong>Hope, Inc. ERP</strong>
          </div>
          <div className="login-heading">
            <div className="login-title">Welcome back</div>
            <div className="login-subtitle">
              Sign in to continue to your Hope ERP workspace.
            </div>
          </div>

          {alert === "invalid" && (
            <div className="login-alert login-alert-error" role="alert">
              <Icon name="alert" size={17} />
              <div>
                <strong>We couldn’t sign you in</strong>
                <span>Check your email and password, then try again.</span>
              </div>
            </div>
          )}

          {alert === "blocked" && (
            <div className="login-alert login-alert-blocked" role="alert">
              <Icon name="lock" size={17} />
              <div>
                <strong>This account has been blocked</strong>
                <span>Contact an Administrator to restore account access.</span>
              </div>
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>Email address</span>
              <div className="login-input">
                <Icon name="mail" size={17} />
                <input
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setAlert(null)
                  }}
                  placeholder="you@company.com"
                  type="email"
                />
              </div>
            </label>

            <label className="login-field">
              <span>Password</span>
              <div className="login-input">
                <Icon name="lock" size={17} />
                <input
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setAlert(null)
                  }}
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={17} />
                </button>
              </div>
            </label>

            <div className="login-options">
              <label className="remember-control">
                <input
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  type="checkbox"
                />
                <span>Remember me</span>
              </label>
              <button className="login-link" type="button">
                Forgot password?
              </button>
            </div>

            <button className="login-submit" type="submit">
              Sign in
              <Icon name="chevron" size={16} />
            </button>
          </form>

          <div className="login-divider">
            <span>or continue with</span>
          </div>

          <button className="google-button" onClick={onSignIn} type="button">
            <span className="google-mark">G</span>
            Continue with Google
          </button>

          <div className="login-register">
            <span>New to Hope ERP?</span>
            <button className="login-link" type="button">
              Create an account
            </button>
          </div>

          <div className="registration-note">
            New accounts are created as User. Role promotion requires an
            Administrator.
          </div>

          <div className="login-demo">
            Demo access: use any valid email and a password with 6+ characters.
            Use <strong>blocked@hope.com</strong> to preview the blocked state.
          </div>
        </div>
      </section>
    </main>
  )
}

function BadgePreview() {
  return <span className="preview-badge">Live</span>
}

function PreviewMetric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <i />
    </div>
  )
}
