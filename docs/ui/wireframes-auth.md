# Hope ERP Landing and Authentication Wireframes

## Task information

| Item | Details |
| --- | --- |
| Task ID | S1-UIX-02 |
| Task name | Wireframes: Landing, Login, Register & Forgot/Reset Password Screens |
| Role | UI/UX Developer |
| Assignee | @AlexGavarra |
| Sprint | Sprint 1, Day 3 |
| Priority | High |
| Reference | Hope, Inc. ERP Student Guide §3.1, Figures 2–5 |

## Design objective

Document five clear, low-to-medium fidelity public and authentication screens for Hope, Inc. ERP. These wireframes describe layout and navigation only; they do not implement authentication, social sign-in, or password-reset behavior.

The screens use a restrained business-oriented layout, obvious action hierarchy, and consistent labels, spacing, and form controls. On narrow screens, content stacks in one column and forms remain within the viewport.

## Public Landing Page — Figure 2

```text
+--------------------------------------------------------------------------+
| HOPE ERP                                      Overview    Sign In   Register |
+--------------------------------------------------------------------------+
|                                                                          |
|              Run your entire business with confidence                   |
|   Hope, Inc. ERP brings your business operations together in one         |
|   unified system, helping your team manage work with clarity.            |
|                                                                          |
|                 [ Sign In to Dashboard ]  [ Register ]                  |
|                                                                          |
|  +------------------+  +------------------+  +------------------+        |
|  | Sales & Orders   |  | Customers        |  | Inventory        |        |
|  | Review sales and |  | Keep customer    |  | Track products   |        |
|  | manage orders.   |  | records together.|  | and stock.       |        |
|  +------------------+  +------------------+  +------------------+        |
|  +------------------+                                                     |
|  | People & Jobs    |                                                     |
|  | Organize employee|                                                     |
|  | and job records. |                                                     |
|  +------------------+                                                     |
|                                                                          |
+--------------------------------------------------------------------------+
| Hope, Inc. ERP                                                © Hope, Inc. |
+--------------------------------------------------------------------------+
```

### Layout and components

- **Header:** Hope ERP wordmark at left; simple Overview, Sign In, and Register navigation at right.
- **Hero:** Centered headline and one-sentence unified-operations subtitle; primary **Sign In to Dashboard** action and secondary **Register** action below.
- **Feature highlights:** Four quiet bordered cards preview Sales & Orders, Customers, Inventory, and People & Jobs. Cards are informational previews, not extra navigation requirements.
- **Footer:** Minimal company label. Keep generous whitespace and align the hero and card grid to a shared content width.

## Registration Screen — Figure 3

```text
+--------------------------------------------------------------------------+
| HOPE ERP                                                   Back to Landing |
+--------------------------------------------------------------------------+
|                                                                          |
|                       Create your account                                |
|                 Join your team on Hope, Inc. ERP                         |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  | NOTICE: New accounts are created as User. Superadmin and Admin     |  |
|  | roles can only be assigned by existing administrators.            |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  First Name                         Last Name                            |
|  [________________________________] [________________________________]   |
|  Email Address                                                            |
|  [____________________________________________________________________]  |
|  Password                                                                 |
|  [____________________________________________________________________]  |
|                                                                          |
|                         [ Register ]                                     |
|                    [ Continue with Google ]                              |
|                                                                          |
|                  Already have an account? Sign In                        |
|                                                                          |
+--------------------------------------------------------------------------+
```

### Layout and components

- Center a single-column form card on the light canvas; keep the two name fields side by side only when there is enough width.
- Place the account notice above the fields, with the exact text shown in the wireframe.
- Use visible labels above the First Name, Last Name, Email Address, and Password controls.
- Make **Register** the primary action; show **Continue with Google** as a secondary social-login placeholder.
- End with a **Sign In** link for existing account holders.

## Login Screen — Figure 4

```text
+--------------------------------------------------------------------------+
| HOPE ERP                                                   Back to Landing |
+--------------------------------------------------------------------------+
|                                                                          |
|                          Sign in to Hope ERP                             |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  | Email Address                                                       |  |
|  | [_______________________________________________________________]  |  |
|  | Password                                                            |  |
|  | [_______________________________________________________________]  |  |
|  | [ ] Remember me                         Forgot password?            |  |
|  |                                                                    |  |
|  |                         [ Sign In ]                                |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  | Demo accounts for evaluation                                       |  |
|  | Email: [Not provided — awaiting approved demo account]             |  |
|  | Password: [Not provided — awaiting approved demo account]          |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|                   New to Hope ERP? Register                              |
|                                                                          |
+--------------------------------------------------------------------------+
```

### Layout and components

- Use the same centered form-card width, field labels, input treatment, and button sizing as Registration.
- Align **Remember me** with its checkbox on the left and **Forgot password?** on the right; wrap these onto separate lines on narrow screens.
- Show the primary **Sign In** action below the fields.
- Keep the demo-account information in a visibly labeled informational box. Repository documentation says no demo accounts are seeded; test-only QA fixtures are not approved evaluation credentials, so no usernames or passwords are presented as demo credentials.
- Include a **Register** link below the form.

## Forgot Password Screen — Figure 5

```text
+--------------------------------------------------------------------------+
| HOPE ERP                                                   Back to Landing |
+--------------------------------------------------------------------------+
|                                                                          |
|                        Forgot your password?                             |
|             We'll send you a secure link to reset it                     |
|                                                                          |
|  Email Address                                                            |
|  [____________________________________________________________________]  |
|                                                                          |
|                         [ Submit ]                                       |
|                                                                          |
|                         Back to Sign In                                  |
|                                                                          |
+--------------------------------------------------------------------------+
```

### Layout and components

- Reuse the centered authentication card and standard Email Address field.
- Place the exact supporting message directly below the heading.
- Make **Submit** the primary action and **Back to Sign In** a secondary text link.

## Reset Password Screen — Figure 5

```text
+--------------------------------------------------------------------------+
| HOPE ERP                                                   Back to Landing |
+--------------------------------------------------------------------------+
|                                                                          |
|                         Reset your password                              |
|                                                                          |
|  New Password                                                            |
|  [____________________________________________________________________]  |
|  Password strength                                                       |
|  [ ] Weak     [ ] Fair     [ ] Strong     [ ] Very strong                |
|                                                                          |
|  Confirm New Password                                                    |
|  [____________________________________________________________________]  |
|                                                                          |
|                      [ Reset Password ]                                  |
|                                                                          |
|                         Return to Sign In                                |
|                                                                          |
+--------------------------------------------------------------------------+
```

### Layout and components

- Use the same card, headings, fields, and primary action style as the other authentication screens.
- Show a visible **Password strength** label and ordered Weak, Fair, Strong, and Very strong indicators. Indicate strength with text as well as visual state; this is a design placeholder, not a strength-checking implementation.
- Keep **Confirm New Password** directly after the new password and place **Return to Sign In** below the primary action.

## Navigation and screen flow

```text
Landing Page --Sign In to Dashboard--> Login --Forgot password?--> Forgot Password
     |                                      ^                           |
     |                                      |                           | Submit
     |                                      | Return to Sign In         v
     +--Register----------------------> Registration              Reset Password
                                               |                         |
                                               +--Sign In----------------+
                                                         Return to Sign In
```

The reset screen is shown after following the secure reset link described by the Forgot Password flow. The wireframes document screen destinations and links only; link delivery and account workflows are outside this task.

## Design consistency notes

- Follow [`design-system.md`](design-system.md): use its brand primary/action colors, light canvas, white form surfaces, subtle borders, and system sans-serif typography.
- Keep page content centered to a shared maximum width; use consistent card padding, vertical rhythm, and alignment.
- Place visible labels above all fields. Text, email, and password inputs share dimensions and border/focus treatment; checkboxes align with their labels.
- Reserve the brand action color for primary buttons and links. Use a neutral outlined treatment for secondary actions, including the Google placeholder.
- Keep supporting copy muted but readable and use text labels in addition to color for notices and password-strength states.
- These are documentation-only wireframes; no interactive UI or authentication behavior is included.
