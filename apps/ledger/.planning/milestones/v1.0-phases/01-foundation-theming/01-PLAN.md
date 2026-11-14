# Phase 1: Foundation & Theming - Plan

**Phase**: 1
**Goal**: Establish Vite project, global routing, PWA shell, and dual-theme switching architecture.

## 01-01: Initialize Vite app, Tailwind, and Framer Motion foundation

**Requirements**:
- Scaffold React (TS) project using Vite.
- Install and configure Tailwind CSS and Framer Motion.
- Set up absolute imports and basic file structure.

**Tasks**:
- `[ ]` 1. Run `npx create-vite@latest . --template react-ts` (or similar) inside the workspace root (ensure the workspace isn't nested redundantly).
- `[ ]` 2. Install dependencies: `npm install tailwindcss postcss autoprefixer framer-motion zustand react-router-dom lucide-react`.
- `[ ]` 3. Initialize Tailwind CSS with `npx tailwindcss init -p`.
- `[ ]` 4. Configure `tailwind.config.js` to process `./src/**/*.{js,ts,jsx,tsx}` and enable dark mode via `class` or `data-theme`.
- `[ ]` 5. Clear `App.tsx` and `index.css` defaults, setting up a clean slate.

## 01-02: Implement dual-theme system, global nav, and PWA configuration

**Requirements**:
- Create dual themes: "Tactical Monospace" vs "Geometric Abstraction".
- Build global Layout component with Sidebar/Top bar.
- Configure PWA via `vite-plugin-pwa`.

**Tasks**:
- `[ ]` 1. **CSS Variables**: Update `src/index.css` to define root CSS variables for the Geometric theme, and a `.theme-tactical` (or `[data-theme='tactical']`) scope for the Tactical theme colors.
- `[ ]` 2. **Tailwind Config**: Map the Tailwind config `theme.extend.colors` to these CSS variables so we can use utility classes like `bg-primary` or `text-accent`.
- `[ ]` 3. **Fonts**: Add Google Fonts imports for `JetBrains Mono` and `Inter` to `index.css`. Assign them to Tailwind's font families.
- `[ ]` 4. **Zustand Store**: Create `src/store/useThemeStore.ts` using `zustand` to manage the active theme and persist it using `zustand/middleware/persist`.
- `[ ]` 5. **Theme Provider/Effect**: Add logic in `src/App.tsx` or a `ThemeProvider` wrapper to apply the active theme as a data attribute or class on `document.documentElement`.
- `[ ]` 6. **Routing & Layout**: Create `src/components/Layout.tsx` with a Sidebar containing navigation links (Dashboard, Budget, etc.) using `react-router-dom`. Add a theme toggle button. Set up `App.tsx` with `BrowserRouter` and routes.
- `[ ]` 7. **PWA Setup**: Install `vite-plugin-pwa`. Update `vite.config.ts` to include the `VitePWA` plugin with a basic manifest (name, short name, icons, theme color) and `generateSW` strategy.
