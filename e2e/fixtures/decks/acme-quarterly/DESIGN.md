# Acme Lab

## Overview

Acme looks like a lab notebook in good daylight. The canvas is a warm off-white `{colors.canvas-soft}` (#f7f4ee) rather than clinical white, type is set in `AcmeSans` in near-black `{colors.ink}`, and the system says exactly one thing in colour: a single teal, `{colors.primary}` (#0f766e), reserved for actions and links. Cards round at 12px (`{rounded.lg}`), marketing CTAs are pills (`{rounded.full}`), utility buttons round at a tighter 8px (`{rounded.md}`).

**Key Characteristics:**
- Warm canvas `{colors.canvas-soft}` over pure white
- One structural accent, Acme Teal `{colors.primary}`
- A decorative sticker palette (`{colors.accent-coral}`, `{colors.accent-amber}`) that never paints structure

## Colors

### Brand
- **Acme Teal** (`{colors.primary}` — #0f766e): the single structural accent; primary CTA fill and link colour.
- **Pressed Teal** (`{colors.primary-active}` — #115e59): press state of the primary CTA.
- **Night** (`{colors.secondary}` — #1e293b): inverted hero band.
- **Sticker Coral** (`{colors.accent-coral}` — #fb7185) / **Deep Coral** (`{colors.accent-coral-deep}` — #9f1239)
- **Sticker Amber** (`{colors.accent-amber}` — #f59e0b)

### Surface
- **White** (`{colors.canvas}` / `{colors.surface}` — #ffffff): cards, panels, fields.
- **Warm Paper** (`{colors.canvas-soft}` — #f7f4ee): the page canvas.
- **Hairline** (`{colors.hairline}` — #e7e5e4): 1px borders and dividers.

### Text
- **Ink** (`{colors.ink}` — #111111): headings and body.
- **Stone** (`{colors.ink-muted}` — #6b7280): supporting copy.

## Typography

### Font Family
The system is set in **`AcmeSans`** with a fallback stack of `Inter, system-ui, "Segoe UI", Arial`.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-1}` | 64px | 700 | 1.0 | −2px | Hero headline |
| `{typography.heading-1}` | 40px | 700 | 1.1 | −1px | Section headline |
| `{typography.body-md}` | 16px | 400 | 1.5 | 0 | Body |
| `{typography.eyebrow}` | 12px | 600 | 1.33 | +0.125px | Labels |

## Layout

### Spacing System
- **Base unit**: 8px.
- **Tokens**: `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px.

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | Fields, chips |
| `{rounded.md}` | 8px | Utility buttons |
| `{rounded.lg}` | 12px | Cards |
| `{rounded.full}` | 9999px | Pills, badges |
