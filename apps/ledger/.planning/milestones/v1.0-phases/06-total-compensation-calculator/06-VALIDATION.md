---
phase: 6
slug: total-compensation-calculator
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Vite project) |
| **Config file** | `vite.config.ts` (vitest inline config) or `vitest.config.ts` if added |
| **Quick run command** | `npm run build` (TypeScript + Vite build check) |
| **Full suite command** | `npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~15–30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npx tsc --noEmit && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | COMP-01 | — | All comp inputs validated as non-negative numbers before storing | build | `npm run build` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | COMP-01 | — | Store persists to localStorage without XSS risk (no eval, no innerHTML) | build | `npm run build` | ✅ | ⬜ pending |
| 06-01-03 | 01 | 2 | COMP-01 | — | Donut chart renders without errors when all comp values are 0 | build | `npm run build` | ✅ | ⬜ pending |
| 06-01-04 | 01 | 2 | COMP-01 | — | Monthly cash flow chart renders correct 12 data points | build | `npm run build` | ✅ | ⬜ pending |
| 06-02-01 | 02 | 1 | COMP-02 | — | Vest event generator produces correct cliff event + post-cliff events | build | `npm run build` | ✅ | ⬜ pending |
| 06-02-02 | 02 | 1 | COMP-02 | — | RSU grant form validates totalGrantValue > 0 before saving | build | `npm run build` | ✅ | ⬜ pending |
| 06-02-03 | 02 | 2 | COMP-02 | — | Vesting chart renders ReferenceLine at cliff month | build | `npm run build` | ✅ | ⬜ pending |
| 06-02-04 | 02 | 2 | COMP-02 | — | Compare delta shows correct sign and color (green/red/neutral) | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework installation needed — build validation via `npm run build` is the primary gate for a Vite TypeScript SPA.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Donut chart donut hole shows hero total comp number centered | COMP-01 | Visual layout (no DOM assertion available) | Navigate to `/compensation`, enter salary, verify hero number appears centered in donut |
| Tactical theme switches all chart colors from blue to green | COMP-01 | CSS variable rendering is visual | Toggle Tactical mode, verify chart strokes use green `--color-accent` |
| RSU vesting chart cliff ReferenceLine label "Cliff" is visible | COMP-02 | SVG label positioning visual | Add RSU with cliff, verify dashed red line with "Cliff" label appears at correct month |
| Compare mode delta color-coding (green=better, red=worse) | COMP-02 | Color perception visual | Enable compare, enter lower base in compare — verify delta badge is red with "−$X,XXX less" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency <30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
