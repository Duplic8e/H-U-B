# Phase 8: CSV Import & Smart Triage Inbox — Discussion Log

## Date
2026-06-19

## Discussed Areas

### 1. CSV Format Handling
- **Options presented:** Visual column mapper vs standard template.
- **User selected:** Custom parsers.
- **Notes:** User will provide actual bank CSV examples for the parsers to be built against.

### 2. Triage Persistence
- **Options presented:** Persistent vs Ephemeral session inbox.
- **User selected:** Persistent Inbox.
- **Notes:** Needs to survive browser reloads using Zustand persist.

### 3. Auto-Categorization
- **Options presented:** Simple substring matching vs 100% manual assignment.
- **User selected:** Simple substring matching.
- **Notes:** Basic auto-categorization based on descriptions will be included in the MVP.
