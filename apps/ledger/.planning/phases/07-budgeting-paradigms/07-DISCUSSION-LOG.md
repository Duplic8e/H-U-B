# Phase 7: Discussion Log

**Data Model for Transactions**
- Presented: Array vs. Indexed object (`Record<string, Transaction>`)
- Selected: Indexed object
- Notes: User expects ~300-400 transactions max per year, but agreed to robust indexed structure.

**Category Hierarchy**
- Presented: Flat Categories vs. Hierarchical Groups
- Selected: Hierarchical Groups
- Notes: Must be fully customizable (add/remove groups and categories).

**Reallocation Mechanics**
- Presented: Option A (Transfer records) vs Option B (Mutate limits directly)
- Selected: Option A
- Notes: The user preferred auditable paper-trail for reallocation.

**Time Boundaries**
- Presented: Roll-over vs Monthly Reset
- Selected: Monthly Reset with Savings Sweep
- Notes: Month resets to targets, unspent funds shown explicitly as going to savings/investments.
