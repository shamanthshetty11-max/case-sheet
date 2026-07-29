## What's changing

Seven adjustments to New log, dashboard, and catalog: patient identity fields, reordered form sections, height/weight, preset placement, closure team dropdown, notes template, surgical-approach dropdown, and a "Re-ex" flow that appends to an existing case.

## 1. Patient details replace patient reference

- Add `patient_name` and `ip_number` inputs to New log (already columns on `procedures`); drop the "Patient reference (MRN / initials)" input.
- Keep `patient_ref` in the type for back-compat with old rows but stop showing/writing it from the form.

## 2. Form section order

Reorder the Core card so the row is: **Patient name · IP number · Category**, then a second row: **Date & time · Procedure name** (procedure name dropdown still filters by the chosen category, which now sits above it).

## 3. Height and weight in Core

- Add `patient_height_cm` (numeric) and `patient_weight_kg` (numeric) columns to `procedures` via migration.
- Extend `Procedure` type + form values; render two compact number inputs in Core.

## 4. Preset fields above Notes

Move the dynamic "Preset fields" section so it renders directly above the Notes section (currently sits lower). No data change.

## 5. Closure dropdown with team members

- Replace the plain "Closed by" input with a combined dropdown listing team surgeons (shown as "Dr. X") + PAs, plus an "Add new…" option that asks whether the new person is a surgeon or PA and saves them to the matching team list.

## 6. Notes prefilled template

When creating a *new* log (no `initial`), seed `notes` with:

```
HbA1c - 
EF -  %
LMCA - 
```

Do not overwrite existing notes on edit. AI scan still fills only if notes are still the untouched template (treat template as empty for the scan overwrite check).

## 7. Surgical approach dropdown

- New table `surgical_approaches(id, user_id, name, sort_order)` with the same RLS + GRANT pattern as `team_surgeons`.
- CRUD helpers in `procedures.ts` (`listSurgicalApproaches`, `addSurgicalApproach`, `deleteSurgicalApproach`, `reorderSurgicalApproaches`).
- In New log: swap the free-text "Surgical approach" for a dropdown of saved approaches with an "Add new…" inline option (mirrors surgeon select).
- In Catalog page: add a small "Surgical approaches" management card (add / delete; reorder can piggyback on existing drag utilities in a later pass — out of scope this turn to keep diff small).

## 8. Dashboard "Re-ex" button (re-exploration on an existing case)

- New button next to Quick scrub-in header: **Re-ex**.
- Opens a dialog listing recent completed procedures (search by name / patient / date). Picking one:
  - Adds a `procedure_reexplorations` row (see schema) with `started_at = now()`.
  - Sets that procedure into an "active re-ex" state visible on the dashboard (similar to Live case card), showing timer + Scrub out.
  - Scrub-out records `ended_at`, `duration_seconds`, and prompts for `reason` + `notes` (textarea). On save, appends a formatted block to the parent procedure's `notes` (`--- Re-exploration MMM d, HH:mm (duration) ---\nReason: …\nNotes: …`) so the info lives on the original log, per user's "under the previous log itself" requirement. Also stored structurally in the re-ex table for future reporting.
- Only one active re-ex at a time. Navigating to the parent procedure shows the re-ex entries in a new "Re-explorations" section on the detail page (read-only list with time + duration + reason).

## Technical details

- **Migration (single call)**:
  - `ALTER TABLE procedures ADD COLUMN patient_height_cm numeric, ADD COLUMN patient_weight_kg numeric;`
  - `CREATE TABLE surgical_approaches (id, user_id, name, sort_order, created_at)` + RLS/GRANT.
  - `CREATE TABLE procedure_reexplorations (id, procedure_id, user_id, started_at, ended_at nullable, duration_seconds int nullable, reason text, notes text, created_at)` + RLS scoped to `auth.uid()` + GRANTs.
- **procedures.ts**: extend `Procedure`, add CRUD for surgical approaches, add `startReexploration`, `endReexploration`, `getActiveReexploration`, `listReexplorations(procedureId)`.
- **procedure-form.tsx**:
  - Seed notes template on new log.
  - Rework Core layout, drop patient_ref input, add height/weight, add IP/patient name.
  - Move Preset fields above Notes.
  - Swap surgical approach input for select with add-new.
  - Rework Closure to team-combined dropdown with add-new (asks surgeon vs PA).
- **dashboard.tsx**: add "Re-ex" button + dialog + active re-ex card (mirrors LiveCaseCard styling).
- **catalog.tsx**: add Surgical approaches management card.
- **procedures.$id.tsx**: add Re-explorations list section.

## Out of scope

- Reordering surgical approaches via drag-drop (only add/delete this turn).
- Editing a saved re-ex entry (delete + re-add if needed).
- Migrating existing `patient_ref` values into `patient_name`.
