---
phase: 02
slug: master-dashboard-layout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest / testing-library |
| **Config file** | none — Wave 0 installs (or existing vitest config) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | DASH-03 | — | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | DASH-01 | — | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | DASH-02 | — | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/dashboard/BentoGrid.test.tsx` — stubs for DASH-03
- [ ] `src/components/dashboard/widgets/NetWorthWidget.test.tsx` — stubs for DASH-01
- [ ] `src/components/dashboard/widgets/AssetsWidget.test.tsx` — stubs for DASH-02

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual hierarchy of Bento Grid | DASH-03 | Aesthetic | Open `/` and verify layout responds cleanly |
| Widget Headers | DASH-03 | Aesthetic | Verify headers use Tactile / Geometric themes properly |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
