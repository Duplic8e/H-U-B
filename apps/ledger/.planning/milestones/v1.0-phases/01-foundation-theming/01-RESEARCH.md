# Phase 1: Foundation & Theming - Research

## Technical Approach

### 1. Initialization
- **Framework**: Use `vite` with the `react-ts` template.
- **Tailwind CSS**: Install `tailwindcss postcss autoprefixer`. Configure `tailwind.config.js` with content paths. We will define custom color palettes using CSS variables to support the dual-theme system.
- **Framer Motion**: Install `framer-motion` for fluid micro-animations and layout transitions.

### 2. Dual-Theme System
- The app requires switching between "Tactical Monospace" and "Geometric Abstraction".
- **Implementation Strategy**:
  - Define theme colors in `src/index.css` using `:root` for the default/Geometric theme, and `.theme-tactical` (or `[data-theme="tactical"]`) for the Tactical theme.
  - Expose these variables in `tailwind.config.js` (e.g., `colors: { background: 'var(--color-bg)', primary: 'var(--color-primary)' }`).
  - Use `Zustand` to store the active theme in `localStorage` so it persists across reloads.
  - A global `ThemeToggle` component will toggle the `data-theme` attribute on the `<html>` or `<body>` tag.

### 3. Routing and Layout
- **Routing**: `react-router-dom` is the standard for Vite SPAs.
- **Shell Layout**: Create a `Layout` component containing a `Sidebar` and a main `Outlet`.
  - The `Sidebar` will hold navigation links to the Dashboard, Budgeting, Investments, etc., and house the `ThemeToggle`.

### 4. PWA Configuration
- **Plugin**: `vite-plugin-pwa`.
- **Manifest**: Define name, short name, theme color, icons.
- **Offline Support**: Use the `generateSW` strategy to precache the React bundle and static assets so the app loads instantly even when offline. Since data is stored in `localStorage`, the app is fully functional without a network.

## Risks & Considerations
- **Tailwind Variables**: Ensure Recharts (used in later phases) can read the CSS variables from the DOM so charts change colors along with the theme. (Using Tailwind CSS variables directly in JS usually requires reading computed styles, or defining a shared color map).
- **Font Loading**: High-end typography (like `JetBrains Mono` and `Inter`) should be preloaded or hosted locally to prevent FOUT (Flash of Unstyled Text) which breaks the premium feel.
