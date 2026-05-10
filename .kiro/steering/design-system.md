---
inclusion: always
---

# KPlayer Analytics - Design System

## Component Development

- **Always check** `@/components/ui/*` first for required elements before creating custom components
- **Use shadcn/ui components** as the foundation; extend only when necessary
- **Prefer composition** over creating new components from scratch
- **Follow New York style** conventions as configured in `components.json`

## Language and Localization

- **Primary language**: Indonesian for all user-facing content:
  - UI text and labels
  - Helper text and tooltips
  - Validation messages
  - Documentation (unless technical requirements mandate English)
  - Team communication
- **English exceptions**: Technical terms, API endpoints, code comments, and variable names may use English

## Design Tokens

Use CSS variables from `src/app/globals.css`:

| Token | Purpose |
|-------|---------|
| `--background` | Page background, card backgrounds |
| `--foreground` | Primary text color |
| `--primary` | Primary buttons, links, active states |
| `--primary-foreground` | Text on primary background |
| `--muted` | Secondary backgrounds, subtle sections |
| `--muted-foreground` | Secondary text, helper text |
| `--accent` | Hover states, subtle highlights |
| `--accent-foreground` | Text on accent background |
| `--border` | Borders, dividers (1px) |
| `--ring` | Focus states (2px visible ring) |

## Visual Style

### Typography
- **Font family**: Poppins (`--font-sans`, `--font-heading`)
- **Weights**: 400 (body), 500 (labels), 600 (headings), 700 (emphasis)
- **Line height**: 1.5 for body text, 1.25 for headings

### Spacing and Layout
- **Max content width**: ~1200px
- **Whitespace**: Generous padding and margins
- **Section backgrounds**: Alternate between `--background` and `--muted`

### Depth and Visual Hierarchy
- **Borders**: 1px using `--border`
- **Shadows**: Soft multi-layer shadows (each layer opacity ≤ 0.05)
- **Elevation**: Subtle depth differences for interactive elements

### Color Palette
- **Base**: Neutral tones
- **Avoid**: Cold grays, harsh contrasts
- **Tone**: Warm, calm, productivity-focused

## Accessibility Requirements

- **Focus states**: 2px visible ring using `--ring`
- **Interactive states**: Clear hover, active, focus, and disabled states
- **Contrast**: Minimum 4.5:1 for text
- **Keyboard navigation**: Full support for all interactive elements

## Code Style

### Component Styling
- **Utility-first**: Tailwind CSS utility classes
- **Variant-based**: `class-variance-authority` for component variants
- **Animations**: `tw-animate-css` for subtle transitions

### Form Styling
- **Label**: Use `--foreground` color, 500 weight
- **Helper text**: Use `--muted-foreground` color
- **Error states**: Use semantic error colors with `--ring` focus

### Table Styling
- **Header**: `--muted` background, `--muted-foreground` text
- **Rows**: Alternating `--background` / `--muted` sections
- **Borders**: 1px `--border` on all sides

## Common Patterns

### Card Component
```
<div className="rounded-xl border border-border bg-background text-foreground shadow-sm">
  <div className="flex flex-col space-y-1.5 p-6">
    {/* Header content */}
  </div>
  <div className="p-6 pt-0">
    {/* Body content */}
  </div>
</div>
```

### Button Component
- Use `class-variance-authority` for variant definitions
- Default: `--primary` background, `--primary-foreground` text
- Outline: `--border` border, `--foreground` text
- Ghost: transparent background, `--accent` hover state

### Input Component
- Border: 1px `--border`
- Focus: 2px `--ring` outline
- Padding: 10px vertical, 12px horizontal
- Helper text below input in `--muted-foreground`
