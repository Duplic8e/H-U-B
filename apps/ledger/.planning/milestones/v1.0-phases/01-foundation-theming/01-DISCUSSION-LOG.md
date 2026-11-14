# Phase 1: Foundation & Theming - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 01-Foundation & Theming
**Areas discussed:** Global Navigation Layout, Theme Storage & Implementation, PWA Configuration & Offline Strategy, Codebase Directory Structure, Tailwind Configuration & Styling Rules

---

## Global Navigation Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Left Sidebar | Fixed on desktop, hamburger menu on mobile. | |
| Top Navigation Bar | Cleaner look, but might get crowded with all the modules planned. | |
| You decide | | |
**User's choice:** Since you are building one app for all screens... Desktop: Fixed Left Sidebar. Mobile: Bottom Tab Bar with top header.

| Option | Description | Selected |
|--------|-------------|----------|
| Show top 4 modules as tabs | Put the rest in a 'More' menu. | ✓ |
| Use a horizontally scrollable tab bar | Keeps everything on one level but less discoverable. | |
| Let the user customize | Powerful but more complex to build. | |
**User's choice:** Show top 4 modules as tabs, put the rest in a 'More' menu.

| Option | Description | Selected |
|--------|-------------|----------|
| Hide on scroll down, reappear on scroll up | Maximizes vertical screen real estate for charts/grids. | ✓ |
| Fixed at the top | Always visible for easy access to theme toggle and settings. | |
| You decide | | |
**User's choice:** Hide on scroll down, reappear on scroll up.

| Option | Description | Selected |
|--------|-------------|----------|
| React Router | Industry standard, robust, well-known patterns. | |
| TanStack Router | Type-safe, modern, great for complex apps. | ✓ |
| Wouter | Minimalist, very lightweight. | |
| You decide | | |
**User's choice:** TanStack Router.

---

## Theme Storage & Implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Zustand global store with persist middleware | Keeps everything unified. | ✓ |
| LocalStorage + standard React Context | Simple, lightweight. | |
| You decide | | |
**User's choice:** Zustand global store with persist middleware.

| Option | Description | Selected |
|--------|-------------|----------|
| CSS variables attached to [data-theme='...'] | Works perfectly with Tailwind. | ✓ |
| Swap entirely different CSS files | Cleaner HTML but slower to switch. | |
| You decide | | |
**User's choice:** CSS variables attached to [data-theme='...'] attributes.

| Option | Description | Selected |
|--------|-------------|----------|
| Hard cut for theme changes | Keeps the 'tactical' snappy feel. | ✓ |
| Smooth cross-fade | Slowly transition background and text colors. | |
| You decide | | |
**User's choice:** Hard cut for theme changes.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, default to OS preference | Allow manual override. | |
| No, always default to the Tactical Monospace theme | Establish premium aesthetic immediately. | ✓ |
| You decide | | |
**User's choice:** No, always default to the Tactical Monospace theme on first load.

---

## PWA Configuration & Offline Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Cache all static assets aggressively | App can run fully offline. | ✓ |
| Cache only the app shell | Basic offline fallback. | |
| You decide | | |
**User's choice:** Cache all static assets aggressively.

| Option | Description | Selected |
|--------|-------------|----------|
| Show a non-intrusive toast notification | Gives the user control. | ✓ |
| Auto-refresh in the background | Seamless but can be jarring if state is lost. | |
| Force a refresh immediately | Ensures everyone is on the latest version. | |
**User's choice:** Show a non-intrusive toast notification with a 'Refresh' button.

| Option | Description | Selected |
|--------|-------------|----------|
| Generate them automatically | Using vite-plugin-pwa assets generator. | ✓ |
| Manually create and manage | Full control over every pixel. | |
| You decide | | |
**User's choice:** Generate them automatically during build using vite-plugin-pwa assets generator.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, detect iOS Safari | Show a friendly guide on how to install. | ✓ |
| No, rely on users knowing | Keeps the UI cleaner initially. | |
| You decide | | |
**User's choice:** Yes, detect iOS Safari and show a friendly guide on how to install.

---

## Codebase Directory Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Feature-based architecture | Highly scalable, keeps module-specific logic contained together. | ✓ |
| Type-based flat structure | Simpler to start, but can get messy. | |
| You decide | | |
**User's choice:** Feature-based architecture (src/features/...).

| Option | Description | Selected |
|--------|-------------|----------|
| src/components/ui/ | Standard approach. | ✓ |
| src/shared/components/ | Clearly separates shared components. | |
| You decide | | |
**User's choice:** src/components/ui/.

| Option | Description | Selected |
|--------|-------------|----------|
| PascalCase | e.g., BentoGrid.tsx. | ✓ |
| kebab-case | e.g., bento-grid.tsx. | |
| You decide | | |
**User's choice:** PascalCase.

---

## Tailwind Configuration & Styling Rules

| Option | Description | Selected |
|--------|-------------|----------|
| Strict utility classes directly in JSX | Follows Tailwind's core philosophy. | ✓ |
| Use @apply in CSS files | Cleans up JSX but can break paradigm. | |
| You decide | | |
**User's choice:** Strict utility classes directly in JSX.

| Option | Description | Selected |
|--------|-------------|----------|
| Use tailwind-merge combined with clsx | Standard practice. | ✓ |
| Let developers manually ensure no conflicting classes | Risky and error-prone. | |
| You decide | | |
**User's choice:** Use tailwind-merge combined with clsx.

| Option | Description | Selected |
|--------|-------------|----------|
| HSL variables in global CSS | Allows opacity modifiers and smooth theme swapping. | ✓ |
| Hex values in global CSS | Simpler to read but doesn't support opacity modifiers. | |
| You decide | | |
**User's choice:** HSL variables in global CSS mapped in tailwind.config.js.

| Option | Description | Selected |
|--------|-------------|----------|
| Use Fontsource npm packages | Self-host the fonts for PWA offline support. | ✓ |
| Import from Google Fonts in index.css | Requires network connection and blocks initial render. | |
| You decide | | |
**User's choice:** Use Fontsource npm packages to self-host the fonts.

---

## the agent's Discretion

None

## Deferred Ideas

None
