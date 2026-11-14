# Phase 1: Foundation & Theming - Context

**Status:** Ready for planning
**Source:** Derived from PROJECT.md and REQUIREMENTS.md

<domain>
## Phase Boundary

Establish the foundational Vite project, configure the PWA shell, set up global routing, and build the dual-theme switching architecture (Tactical Monospace and Geometric Abstraction).
</domain>

<decisions>
## Implementation Decisions

### Tech Stack
- Frontend framework: React (Vite SPA)
- Styling: Tailwind CSS
- Animation: Framer Motion
- Global State: Zustand

### Theming System
- Strict dual themes: Tactical Monospace vs Geometric Abstraction.
- Managed via Tailwind CSS variables.
- Toggle must be instant with no page reloads.

### PWA Configuration
- Local-first architecture using LocalStorage.
- Offline support via Vite PWA plugin.

### Routing & Navigation
- Global navigation using `react-router-dom`.
- Shell layout features a Sidebar/Top bar to toggle between modules.
</decisions>

<canonical_refs>
## Canonical References

- `c:\Users\misha\ledger\.planning\PROJECT.md` — High-level architecture and vision
- `c:\Users\misha\ledger\.planning\REQUIREMENTS.md` — Feature requirements and phase boundaries
</canonical_refs>

<specifics>
## Specific Ideas

- Avoid Bootstrap-style generic templates. Use high-contrast, premium "engineering command center" design language.
- Fonts: Consider using `JetBrains Mono`/`Fira Code` for Tactical, and `Inter`/`Outfit` for Geometric.
</specifics>

<deferred>
## Deferred Ideas

- User authentication and cloud sync (Deferred to v2).
- Live Bank Sync (Plaid).
- Backend databases.
</deferred>
