# Hope ERP Design System

This document defines the shared visual tokens and component behavior for Hope ERP screens. Use it as the UI handoff reference so future screens stay consistent.

## Brand and color tokens

| Token | Value | Use |
| --- | --- | --- |
| `--brand-primary` | `#1E3A8A` | Primary brand and navigation emphasis |
| `--brand-action` | `#2563EB` | Primary buttons, links, and interactive focus |
| `--nav-header` | `#0F172A` | Dark application header |
| `--nav-sidebar` | `#1E293B` | Sidebar surface |
| `--surface` | `#FFFFFF` | Cards, forms, and dialogs |
| `--canvas` | `#F8FAFC` | Main content background |
| `--text-primary` | `#0F172A` | Main text |
| `--text-muted` | `#64748B` | Supporting text |
| `--border` | `#E2E8F0` | Input, table, and card borders |
| `--status-active-bg` | `#D1FAE5` | Active status badge background |
| `--status-active-text` | `#065F46` | Active status badge text |
| `--status-inactive-bg` | `#FEE2E2` | Inactive and blocked badge background |
| `--status-inactive-text` | `#991B1B` | Inactive and blocked badge text |
| `--row-deleted` | `#F1F5F9` | Soft-deleted table row tint |

```css
:root {
  --brand-primary: #1e3a8a;
  --brand-action: #2563eb;
  --nav-header: #0f172a;
  --nav-sidebar: #1e293b;
  --surface: #ffffff;
  --canvas: #f8fafc;
  --text-primary: #0f172a;
  --text-muted: #64748b;
  --border: #e2e8f0;
  --status-active-bg: #d1fae5;
  --status-active-text: #065f46;
  --status-inactive-bg: #fee2e2;
  --status-inactive-text: #991b1b;
  --row-deleted: #f1f5f9;
}
```

## Typography and layout

- Use `Inter`, `Roboto`, or the system UI sans-serif stack; avoid mixing font families within a screen.
- Keep page titles, section headings, labels, and supporting text visually distinct and consistently sized.
- Use a sticky dark header and a dark fixed or collapsible sidebar on desktop. The main canvas fills the remaining width and uses the canvas background.
- At smaller widths, collapse the sidebar into a navigable drawer and allow wide data tables to scroll horizontally rather than compressing their content.
- Keep controls and content aligned to a consistent spacing scale; use white surfaces and subtle borders to separate cards and forms from the canvas.

## Reusable component guidance

### Buttons

Provide primary, secondary, outline, danger, and success variants. Primary actions use the brand action color; secondary actions use a neutral surface; outline actions use a visible border; danger is for destructive actions; success is for restore or confirmation actions. Include hover, keyboard-focus, disabled, and loading states where applicable.

### Form controls

Text, password, and email inputs share the same height, border, padding, and focus treatment. Dropdowns follow the same visual rules. Put a visible label above each control; align checkboxes with their labels and make the full label clickable. Show validation feedback next to the relevant field without relying on color alone.

### Status badges and tabs

Use the active green and inactive/blocked red tokens above for status badges, with readable text in addition to color. Soft-deleted records remain visible when requested, but use the tinted row background and muted text.

The status tabs are **Active (x)**, **Inactive (y)**, and **All (z)**. Counts reflect the current dataset and update when records change; selecting a tab filters the displayed rows without changing their status.

### Data tables

Use clear column headings, consistent cell padding, subtle row separators, and alignment suited to the data. Keep actions grouped consistently in the row. Preserve horizontal scrolling on narrow screens and apply the soft-deleted tint to deleted rows.

### Modal dialogs

Place dialogs in a centered overlay with a distinct surface, a close control, and a clear title. Keep form content in the body and align cancel/confirm actions in a footer. The overlay must not obscure the dialog or prevent keyboard users from reaching its controls.
