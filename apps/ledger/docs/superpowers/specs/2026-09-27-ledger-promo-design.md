# Ledger promotional video brief

Date: 2026-09-27
Status: Creative direction agreed through discussion; consolidated brief and narration ready for user review. Production has not started.

## Objective and audience

Create a 60-second landscape promo that persuades someone overwhelmed by spreadsheets and disconnected financial tools to start using Ledger with their own finances. Lead with convenience and clarity. Investment depth and privacy support that promise.

Primary distribution is direct sharing with friends, communities, and potential users. End with "Get started with Ledger" and miishat.github.io/ledger/.

## Deliverable and creative treatment

- Target: 1920 x 1080, 16:9, 30 fps, 60-second MP4 with voice, music, and readable captions. Retain editable production sources and a subtitle file.
- Modern, professional product promo. Premium excitement leads, supported by calm relief and practical confidence.
- Real Ledger screens with smooth zooms and transitions. Occasional enlarged callouts repeat actual displayed results.
- No stock footage. Opening fragmentation can use original typography and cropped fictional financial examples.
- Quickly switch themes, then use Gilded Bloom for the remainder. Its current internal theme key is nouveau.
- Warm, conversational synthetic narrator with a neutral North American accent. No gender preference was specified; choose based on available voice quality.
- Restrained instrumental music under narration, with gentle transition accents. Use original or appropriately licensed audio with recorded provenance.
- Use fictional Canadian finances in CAD, with Ontario selected for tax calculations.

## Story and timing

The narrative moves from scattered finances to one clear picture, followed by practical planning examples. Supporting tools receive focused glimpses, not full tutorials.

| Time | Picture | Narration draft |
| --- | --- | --- |
| 0-9 seconds | Separate budget, investment, and salary figures create the opening problem. | Your budget in one spreadsheet. Investments somewhere else. And that raise? What would you actually take home? |
| 9-13 seconds | Reveal Ledger. Brief theme changes settle on Gilded Bloom. | Bring it together with Ledger. |
| 13-26 seconds | Salary and Tax Calculator: Ontario, gross salary from CAD 80,000 to 100,000. Highlight actual take-home results, then focus on the RRSP Efficiency table and potential deductible contribution savings. | See what a higher salary could mean after tax. Explore how RRSP contributions could work harder for you. |
| 26-39 seconds | Debt payoff, rent versus buy, then Net-Worth / FIRE Forecaster. One clearly framed result per tool. | Compare debt payoff strategies. Weigh renting against buying. And see whether you're on track for financial independence. |
| 39-51 seconds | Brief bank CSV import, visible budgeting options, insights, then overall dashboard. | Import bank transactions, enter your balances, and choose a budgeting style that fits. Turn your spending into insights, with your financial picture in one place. |
| 51-55 seconds | Hold a calm, clean product composition with the privacy caption. | Your finances stay on your device. No account required. |
| 55-60 seconds | Ledger name and clear website address. | Get started with Ledger. |

Timing is an editorial target to validate against the generated voice. Tighten wording and shot transitions within 60 seconds; do not silently remove requested features or accelerate the voice until it sounds rushed. The URL stays visible for the closing five seconds and need not be spoken.

## Required feature coverage

1. Quick theme switching, followed by Gilded Bloom.
2. Ontario salary estimate from CAD 80,000 to 100,000, using the product's actual calculated take-home results.
3. RRSP contribution efficiency table, showing marginal saving bands and potential tax savings. Any visible deduction-room amount belongs to the fictional scenario. Do not imply a universal optimal contribution or guaranteed savings.
4. Debt payoff comparison.
5. Rent versus buy, specifically the current tool's modeled comparison. Do not relabel its unrecoverable-cost result as a complete wealth comparison.
6. FIRE planning and progress toward financial independence, presented as a projection based on assumptions.
7. Bank CSV import and manually entered balances, faithfully representing the onboarding workflow.
8. All current budgeting choices: Ledger Custom, Zero-Based, Target-Based, and 50/30/20. Showing the options is sufficient; no separate explanation for each.
9. Budget insights and the overall dashboard. No specific insight metric was requested; select a clearly readable, meaningful result from the fictional example.
10. Local storage message and no account required.
11. Exact closing action and live destination above.

## Production constraints and capability findings

Use tools already available and incur no paid purchases. The user welcomes suggestions for free tools or plugins that improve quality; ask before installing a proposed addition. No installation or external account signup has been authorized yet.

Initial inspection found Node, Python, the project's Playwright dependency, and Codex's bundled runtimes. No dedicated video or speech generation connector was found among callable tool names. FFmpeg, FFprobe, and Blender did not resolve on PATH. This does not establish whether equivalent bundled binaries exist elsewhere. Narration quality and video encoding capability require a production preflight before committing to a pipeline.

Do not substitute a silent film for the requested narrated deliverable without discussing the limitation. First test available synthesis, capture, and rendering capabilities. If an essential capability is missing, propose a concrete free addition and explain its role.

## Product evidence

- src/components/theme/themeSwatches.ts: Gilded Bloom appearance and internal key.
- src/store/useBudgetStore.ts and src/types/budget.ts: the four current budgeting options.
- src/components/planner/SalaryTaxTool.tsx: salary and optional CRA deduction-room inputs.
- src/components/planner/RrspEfficiencyCard.tsx: RRSP efficiency bands and potential savings.
- src/components/planner/toolRegistry.tsx: planner names and descriptions, including FIRE.
- src/components/planner/RentVsBuyCalculator.tsx: modeled unrecoverable costs.
- README.md: local storage, no account, optional user-controlled sync, and live URL.

## Acceptance checks

- All required scenes are present in a 60-second 16:9 render, with no clipped text, unreadable key results, blank frames, or abrupt audio cuts.
- Capture real product screens using isolated fictional data. Do not record the user's personal financial state.
- Displayed callouts match the current captured calculations. Keep cash available after contributions distinct from net pay before those contributions.
- Narration is intelligible, natural, and not masked by music. Captions remain readable without sound and stay clear of featured numbers.
- Verify the final encoded duration, resolution, audio track, and playback. Review the entire video, including transitions and final URL hold.
- Retain the sources, example data, audio provenance, and reproducible rendering instructions.

## Review

Self-review completed for scope, requested feature coverage, timing, and product claims. Production feasibility is explicitly pending the capability preflight. This brief is ready for the user's final script and sequence review.
