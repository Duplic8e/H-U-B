---
phase: 06
slug: total-compensation-calculator
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-19
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| user form input → component state → store | Untrusted numeric/text input (salary, bonus, RSU grant names, shares, prices, vest months) crosses from form fields into local React state and the persisted Zustand store. | User-supplied compensation figures and free-text grant names. Low sensitivity (user's own data). |
| persisted store → localStorage | Zustand `persist` middleware serializes the compensation store to `localStorage`. | User's own compensation figures on their own device. |

*Client-only, single-user PWA. No server, no auth surface, no cross-user trust. No network endpoints introduced by this phase.*

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| 06-01-T01 | Tampering (XSS) | User strings (package name, RSU grant names) | accept | React auto-escaping renders all user strings as text nodes; no `dangerouslySetInnerHTML`. Risk accepted (client-only, own-device). | closed |
| 06-01-T02 | Tampering (input validation) | Numeric inputs (salary, bonus, shares, price) | accept | `parseFloat` fallback to 0, `min="0"` on number inputs, NaN filtered in calculators. Risk accepted. | closed |
| 06-01-T03 | Denial of Service (availability) | localStorage hydration | accept | Zustand persist falls back to default state on parse error. Risk accepted. | closed |
| 06-02-T01 | Tampering (XSS) | Grant names in chart / SVG labels | accept | Recharts `label` prop auto-escapes; grant names rendered as React text nodes, never raw HTML/SVG. Risk accepted. | closed |
| 06-02-T02 | Denial of Service | Unbounded vest-timeline computation | accept | `totalVestMonths` clamped 1–120, frequency restricted to `monthly`/`quarterly` enum. Risk accepted. | closed |
| 06-04-T01 | Tampering | RSU numeric inputs (shares, price, months) in CompareView | accept | Inputs coerced with `Number(...)`; `calcAnnualRSU`/`generateVestEvents` guard with `\|\| 0` and `Math.floor`. NaN/empty coerces to 0 — no crash, no privilege. | closed |
| 06-04-T02 | Information Disclosure | `comparePackage` in persisted localStorage | accept | User's own compensation figures on their own device; no new sensitive surface beyond the existing primary package. | closed |
| 06-04-SC | Tampering (supply chain) | npm installs | accept | No new packages installed in this phase; all types and calculators already exist in the repo. N/A by inspection. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | 06-01-T01, 06-02-T01 | XSS via user-controlled strings is structurally prevented by React auto-escaping in a client-only single-user PWA; no server-side rendering or HTML injection sink exists. | mishath@marvell.com | 2026-06-19 |
| AR-02 | 06-01-T02, 06-04-T01 | Malformed numeric input degrades gracefully (coerces to 0 via `Number(...)`/`parseFloat` + `\|\| 0` guards); no crash or privilege escalation possible. | mishath@marvell.com | 2026-06-19 |
| AR-03 | 06-01-T03 | localStorage corruption falls back to default state via Zustand persist error handling; worst case is loss of locally-stored figures the user can re-enter. | mishath@marvell.com | 2026-06-19 |
| AR-04 | 06-02-T02 | Vest-timeline computation is bounded by input clamps (1–120 months, enum frequency); DoS surface is the user's own browser only. | mishath@marvell.com | 2026-06-19 |
| AR-05 | 06-04-T02 | Persisted compensation data is the user's own data on their own device; no cross-user or network exposure introduced. | mishath@marvell.com | 2026-06-19 |
| AR-06 | 06-04-SC | No new dependencies introduced this phase; supply-chain surface unchanged. | mishath@marvell.com | 2026-06-19 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-19 | 8 | 8 | 0 | /gsd-secure-phase (user-accepted, no code-verification pass) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-19
