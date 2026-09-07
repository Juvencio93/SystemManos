# Premium Design System Implementation Plan

Implement a modern SaaS UI/UX for Matriz and Filial dashboards, focusing on premium visual hierarchy, consistent design tokens, and responsive behavior without changing business rules or functionality.

## Design Tokens & Core Styles

- Update `src/styles.css` with standardized premium tokens:
  - Deep dark backgrounds (`oklch(0.12 0.02 264)` for main, `oklch(0.16 0.03 264)` for cards).
  - Modern border-radius (16px to 20px).
  - Typography scale: Titles (32px-72px), Body (15px-16px), Metrics (36px-48px).
  - Primary Manos Tech color: Cyan/Blue gradient (`--color-primary`).

## Component Enhancements

- **Cards**:
  - Apply `glass-panel` utility globally.
  - Refine padding (24px-32px).
  - Consistent header structure with Lucide icons.
  - Hover effects: subtle lift and border glow.
- **Metrics**:
  - Enlarge primary numbers (font-display, font-bold, tracking-tight).
  - Clear label hierarchy with muted secondary text.
  - Status indicators using semantic colors (Success, Warning, Destructive, Info).
- **Buttons & Badges**:
  - Standardize height (h-11 for buttons) and font weight.
  - Soft-background badges with high-contrast text.
- **AI Agent (Manos Tech IA)**:
  - Refine `AiStructuredResponse` with better spacing, refined lists, and clearer section headers.
  - Ensure the floating assistant chat widget follows the premium aesthetic (better shadows, glassmorphism).

## Dashboard Layout Updates

- **Matriz/Filial Dashboard (`src/routes/_authenticated/dashboard.tsx`)**:
  - Improve grid spacing (gap-6 or gap-8).
  - Re-align module cards and stats grid for better balance.
  - Ensure headings use the updated display font.
- **Responsive Adjustments**:
  - Stack metrics vertically on mobile.
  - Ensure 100% width for interactive elements on small screens.
  - Horizontal scroll for wide tables without breaking layout.

## Specific Route Refinements

- **Filiais (`src/routes/_authenticated/filiais.tsx`)**: Premium table styling and form layout.
- **Relatórios (`src/routes/_authenticated/relatorios.tsx`)**: Card-based report list with improved hierarchy.
- **Campanhas (`src/routes/_authenticated/campanhas.tsx`)**: Refined campaign grid and action buttons.
- **Financeiro (`src/routes/_authenticated/financeiro/index.tsx`)**: Standardize cards and colors with the new system.

## Technical Validation

- Check for layout overflows on mobile viewports.
- Verify color contrast for accessibility (WCAG AA).
- Confirm no functional regressions in AI limits, billing, or auth.
