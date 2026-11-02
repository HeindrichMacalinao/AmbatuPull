# Hope ERP Hi-Fi Mockups & Developer Handoff

## Task information

| Item | Details |
| --- | --- |
| Task ID | S1-UIX-04 |
| Role | UI/UX Developer |
| Assignee | @AlexGavarra |
| Sprint / Due | Sprint 1, Day 6 |
| Priority | High |
| Reference | Hope, Inc. ERP Student Guide Figures 2–8, 35–40 |

## Scope and artifact

The browser prototype is [`/hifi-mockups.html`](../../public/hifi-mockups.html), served by the existing Express static-file middleware when the app is running. It builds on [`wireframes-auth.md`](wireframes-auth.md), [`wireframes-dashboard-user-management.md`](wireframes-dashboard-user-management.md), and [`design-system.md`](design-system.md). Use its screen selector to inspect Landing, Login, Register, Forgot Password, Reset Password, the three role dashboards, User Management, and the component-state board.

The repository does not contain a frontend framework or an existing component stylesheet; `public/7.tsx` is an empty placeholder. This is a dependency-free HTML/CSS/JavaScript prototype, not an integrated production frontend. Its forms, role switch, account status buttons, and rights dialog update only local browser presentation. They send no requests and persist no data.

## Visual system and spacing

The mockup reuses the established Hope ERP design-system colors: brand primary `#1E3A8A`, action blue `#2563EB`, dark header `#0F172A`, sidebar `#1E293B`, canvas `#F8FAFC`, white surfaces, muted text `#64748B`, and border `#E2E8F0`. Active and blocked badges use the documented green and red tokens. Inactive rows use the existing soft-deleted tint `#F1F5F9`, with readable slate text. The type stack is system UI/Inter-compatible; no remote font is required.

| Token | Value | Intended use |
| --- | ---: | --- |
| XS | 4px | Icon/text alignment and small gaps |
| SM | 8px | Compact control and component spacing |
| MD | 16px | Standard card padding and form-field gaps |
| LG | 24px | Section spacing and compact desktop page gutters |
| XL | 32px | Major content spacing and wide desktop page gutters |

The prototype declares `--space-xs`, `--space-sm`, `--space-md`, `--space-lg`, and `--space-xl` in its inline stylesheet. CSS uses the same 4/8/16/24/32-pixel rhythm; component-specific 6, 9, 10, 11, 12, 14, 17, 18, 20, 22, and 28-pixel values are optical refinements, not additional spacing tokens.

## Implemented component classes

These are actual selectors in the prototype stylesheet, not suggested framework class names. CSS is scoped to the page in `public/hifi-mockups.html`; no CSS Modules, Tailwind, or global application stylesheet currently exists.

| Component | Implemented classes / selectors |
| --- | --- |
| Prototype controls | `.prototype-bar`, `.screen-picker`, `.screen-picker__button`, `.screen`, `.screen.is-active`, `.prototype-note` |
| Buttons | `.button`, `.button--primary`, `.button--secondary`, `.button--danger`, `.button--success`, `.button--link`, `.button--small`, `.button--error`, `.button:disabled`, `.button:focus-visible` |
| Inputs and labels | `.form-field`, `.form-field__label`, `.form-field__input`, `.form-field__select`, `.form-field__input:hover`, `.form-field__input:focus`, `.form-field__input:disabled`, `.form-field__input.is-error`, `.form-field__error`, `.form-field__hint` |
| Cards and dashboard | `.card`, `.card__header`, `.kpi-grid`, `.kpi-card`, `.quick-grid`, `.quick-action`, `.quick-action.is-restricted`, `.activity-list` |
| Header and sidebar | `.app-header`, `.brand`, `.sidebar`, `.sidebar__label`, `.nav-link`, `.nav-link.is-current`, `.nav-link--disabled`, `.workspace` |
| Tables | `.table-scroll`, `.data-table`, `.data-table__person`, `.data-table__row--inactive`, `.filter-tabs`, `.filter-tab`, `.table-foot` |
| Badges | `.status-badge`, `.status-badge--active`, `.status-badge--blocked`, `.status-badge--inactive`, `.role-badge`, `.role-badge--superadmin`, `.role-badge--admin`, `.role-badge--user` |
| Dialogs | `.modal-backdrop`, `.modal-backdrop.is-open`, `.modal`, `.modal--wide`, `.modal__header`, `.modal__body`, `.modal__footer` |
| Rights controls | `.checkbox-label`, `.permission-list`, `.permission-group`, `.permission-group__header`, `.permission-group__title`, `.permission-group__shortcuts`, `.permission-group__items` |
| Error and status messaging | `.inline-alert`, `.inline-alert--warning`, `.inline-alert--danger`, `.demo-feedback`, `.demo-toast` |

The CSS state board presents active, hover, focus, disabled, and error examples together. The focused and hover examples use explicit demo classes so those states remain visible without pointer or keyboard interaction. In a production implementation, retain equivalent `:hover`, `:focus-visible`, and `:disabled` styling rather than forcing those demo classes onto controls.

## Icons

Icons are small inline SVG symbols embedded in the same HTML file. The source is the prototype's local `<symbol>` sprite; no icon library, remote asset, or added package is used. `<svg class="icon"><use href="#…"></use></svg>` references the symbol IDs.

| Symbol | Purpose | Screens |
| --- | --- | --- |
| `i-grid` | Dashboard navigation | Role dashboards, User Management |
| `i-users` | Customers, people, user navigation | Landing, dashboards, user table, quick actions |
| `i-box` | Product and inventory navigation | Landing and dashboards |
| `i-cart` | Sales and orders | Landing and dashboards |
| `i-briefcase` | HR / people and jobs | Landing and dashboards |
| `i-settings` | System Settings | Superadmin dashboard |
| `i-trend` | Revenue KPI | All dashboard views |
| `i-search` | User table search | User Management |
| `i-plus` | Add User action | User Management |
| `i-arrow` | Primary landing action direction | Landing |
| `i-lock` | Authentication/security callout | Authentication |
| `i-shield` | Security / frontend-only notices | Prototype and authentication |
| `i-close` | Dialog close control | Add/Edit User and Rights dialogs |
| `i-check` | Authentication feature bullets | Login |

## Screen and responsive behavior

- **Authentication:** Landing, Login, Register, Forgot Password, and Reset Password use the text and flow from the existing authentication wireframes. A shared branded header, split information/form card, visible field labels, and clear primary action establish a consistent hierarchy.
- **Dashboards:** Superadmin shows Customers, Products, HR, Sales, User Management, and System Settings. Admin omits System Settings. User shows an illustrative rights-limited navigation/action set and disabled restricted actions. Each role has the four requested KPI labels; example values are explicitly mock data.
- **User Management:** The role comparison selector hides Superadmin rows in the Admin view and displays `—` for peer Admin actions. The inactive row remains visible and shaded. Active users show Block; blocked users show a red Blocked badge and Unblock. In the prototype, these controls only switch the displayed row state.
- **Add/Edit User:** A modal shows name, email, and role controls. Save runs browser required-field validation and displays a local-only acknowledgement; it does not create or update an account.
- **Rights Dialog:** Permission names and codes come from the canonical 36-right catalog. Per-module master controls, All/None shortcuts, and individual rights update a staged in-browser selection associated with the selected sample user. Partial group selection sets the native checkbox `indeterminate` property. Cancel closes without updating that user's local saved draft; Save updates only the prototype's browser-local map.
- **Component states:** The UI States screen explicitly shows the five requested input states and button states. Form submission feedback states clearly that no authentication or reset request was made.
- **At 1920×1080:** The desktop layout retains the full 238px sidebar, 32px workspace gutters, four KPI columns, dashboard two-column content, and multi-column permission groups.
- **At 1366×768:** The `max-width: 1440px` breakpoint reduces the sidebar to 216px, workspace gutters to 24px, and card gaps while retaining four KPI columns. Content can scroll vertically; tables use a horizontal overflow container.
- **At narrower widths:** Below 1050px the sidebar becomes a compact icon rail and KPI cards use two columns. Below 720px the app gutters and cards tighten, auth panels stack, permission controls use two columns, and table overflow remains contained. This is a desktop-responsive prototype, not a fully tested mobile navigation drawer.

The reference Student Guide itself (PDF or image set for Figures 2–8 and 35–40) is not present in the repository. Text described as exact below is copied from the committed S1-UIX-02 wireframe, not independently verified against the guide. Dashboard names, demo identities, activity, and totals are implementation examples/placeholders.

## Text copy

The following available wireframe text is retained in the mockup:

- Landing: “Run your entire business with confidence”; “Hope, Inc. ERP brings your business operations together in one unified system, helping your team manage work with clarity.”; “Sign In to Dashboard”; “Sales & Orders”; “Review sales and manage orders.”; “Customers”; “Keep customer records together.”; “Inventory”; “Track products and stock.”; “People & Jobs”; “Organize employee and job records.”
- Registration: “Create your account”; “Join your team on Hope, Inc. ERP”; “First Name”; “Last Name”; “Email Address”; “Password”; “Register”; “Continue with Google”; “Already have an account? Sign In”; “New accounts are created as User. Superadmin and Admin roles can only be assigned by existing administrators.”
- Login: “Sign in to Hope ERP”; “Remember me”; “Forgot password?”; “Sign In”; “New to Hope ERP? Register.”
- Recovery: “Forgot your password?”; “We'll send you a secure link to reset it”; “Submit”; “Back to Sign In”; “Reset your password”; “New Password”; “Password strength”; “Confirm New Password”; “Reset Password”; “Return to Sign In.”
- User/rights: “User Management”; “Add User”; “Name”; “Email”; “Role”; “Status”; “Actions”; “Active”; “Blocked”; “Block”; “Unblock”; “Rights”; “Edit”; “All”; “None”; “Cancel”; “Save Rights.” Rights labels and codes match `db/seeds/003_initial_access_catalog.sql`.

Other feedback, helper copy, sample account data, and illustrative metric values are implementation placeholders, not claims about Student Guide verbatim copy or live ERP data.

## State transitions and integration boundaries

| Flow | Prototype display behavior | Backend/integration responsibility |
| --- | --- | --- |
| Auth form | Native required/email validation; focus and error examples; local feedback on submit | Authenticate, validate policy, create/manage a session, safely return errors, and never expose password values |
| Registration / reset | Form screens and navigation only; no request is sent | Implement registration and one-time reset-token delivery/validation; apply server-side password rules |
| Active → Blocked | Row badge changes from Active to red Blocked; action changes from Block to Unblock | Verify actor and target role, persist `isBlocked`, audit the change, reject blocked sessions/logins as applicable |
| Blocked → Active | Unblock returns the display badge/action to Active/Block | Authorize and persist the unblock; confirm session and audit semantics |
| Inactive account | Distinct gray Inactive badge and shaded, readable row; separate from Blocked | Define retention/soft-delete behavior and which Admins may list or restore inactive records. The current schema has `status` Active/Inactive and `isBlocked`; it has no separate deleted-at flag. Do not equate Inactive with Blocked or assume deletion semantics. |
| Edit/Add user | Modal, fields, browser-required validation, local completion notice | Enforce role boundaries, uniqueness, server validation, stamp/audit updates, and persistence |
| Rights selection | Checkbox toggles one right; module master and All/None set that group; mixed selection is indeterminate; Cancel discards draft; Save updates local draft only | Verify caller/target authority, validate canonical right codes, atomically persist grants/revocations, audit changes, and enforce rights server-side (including 403 for denied actions) |
| Role visibility | User sees example granted actions and hidden/disabled restricted navigation; Admin peer/Superadmin visibility is illustrated in User Management | Apply authorization to both list/read and mutation routes. UI hiding is not security enforcement. |

The DB catalog supplies five modules and 36 right codes. The current Express route module implements only `GET /api/health`; it does not implement these UI flows. `docs/sprints/sprint-1-mid-check.md` records planned auth/user-management routes and a proposed rights contract (`GET/PUT /api/users/:id/rights`), but those are handoff references, not verified live endpoints or finalized request/response schemas. Confirm endpoint paths, payloads, errors, and inactive-row rules with the backend owner before integration; this document does not invent them.

## Frontend and backend handoff

### Frontend

1. Use the existing Hope ERP color tokens and the five spacing values above; align authentication, dashboard, table, and modal surfaces with the selectors in this prototype.
2. Replace the prototype's screen picker and inline demo data with application routing/state. Preserve semantic labels, visible status text, keyboard focus rings, and disabled/error messages.
3. Keep the blocked state distinct from inactive/soft-deleted presentation. Keep inactive rows visible for the Admin view only if confirmed by the final role policy.
4. Bind the rights form to canonical `rightCode` values, derive module master checked/indeterminate state from selected children, and keep edits staged until Save succeeds. Cancel discards pending edits.
5. At desktop widths around 1920 and 1366 pixels, retain sidebar/content hierarchy and four KPI columns. At smaller widths, avoid horizontal page overflow and keep wide tables/dialog bodies independently scrollable.

### Backend

1. Confirm with @Tysennn which auth, user, block/unblock, soft-delete, and rights endpoints are implemented, including request/response types and error behavior. The current `src/routes/index.js` exposes health only.
2. Enforce role/right checks on every API operation; do not rely on the role selector, hidden navigation, disabled actions, or dialog state.
3. Keep `isBlocked` separate from account `status`. Define whether an inactive account is merely disabled or soft-deleted and which role can see/manage it; the current schema does not record a deletion timestamp or deleted-by actor.
4. For rights changes, validate the canonical catalog and target eligibility on the server, perform grants/revocations atomically, maintain required audit stamps, and return a clear outcome for stale or unauthorized changes.
5. Provide KPI data only after the backend defines permitted metrics and role-specific data visibility. Values in the mockups are not live SQL results.

## Handoff review status

**Pending — not yet reviewed or approved by @Tysennn.** Review request should focus on the active/blocked/inactive distinction, Admin visibility of inactive rows, status/audit behavior, role boundaries, and rights-assignment contract. No approval is implied by this document.
