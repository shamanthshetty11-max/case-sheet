## What we're building

Seven changes to CaseSync: reorderable team lists, a rename, an unsaved-changes guard, a scrub-in/out quick tracker, a procedures-per-category manager with reusable presets, a "closed by" field, and preset-driven custom fields on New log.

## 1. Rename "New procedure" → "New log"

- Update nav link label in `_authenticated/route.tsx`.
- Update page heading and `<head>` title/description in `procedures.new.tsx`.
- Update dashboard "New" button and empty-state CTA copy.

## 2. Unsaved-changes guard on New log

- In `ProcedureForm`, track a `dirty` flag (any field change after mount).
- Use TanStack Router `useBlocker({ withResolver: true, shouldBlockFn: () => dirty })` plus `enableBeforeUnload: dirty` for browser back/refresh.
- Render a styled AlertDialog with "Save & leave", "Discard", "Stay". Only active on New log, not on the edit route (or on edit only when dirty too — same hook works). Clear `dirty` on successful save.

## 3. Reorder surgeons and PAs (drag & drop)

- Add `sort_order integer not null default 0` to `team_surgeons`, `team_pas`, and the new `procedure_names` table.
- Install `@dnd-kit/core` + `@dnd-kit/sortable`.
- In `team.tsx`, wrap each list in a `SortableContext` with drag handles; on drop, persist new order via a batched update helper in `procedures.ts` (`reorderTeamSurgeons(ids)` / `reorderTeamPAs(ids)`).
- List queries order by `sort_order asc, created_at asc`.
- Dropdowns in `procedure-form.tsx` inherit the saved order.

## 4. Scrub in / Scrub out quick tracker (dashboard)

- New card on the dashboard: "Live case". Fields: Patient name, IP number, Diagnosis, Procedure name (uses the procedure-name dropdown for the chosen category if a category is picked; otherwise free text).
- "Scrub in" button → creates a `procedures` row immediately with `performed_at = now()`, `status = 'in_progress'`, `scrub_in_at = now()`, plus whatever fields the user filled. Shows an "In progress" chip on the dashboard with a "Scrub out" button and elapsed timer.
- "Scrub out" button → sets `scrub_out_at = now()`, `total_duration_seconds = diff`, `status = 'completed'`, then routes to `/procedures/$id` (edit) so the user finishes details.
- Schema: add `status text default 'completed'`, `scrub_in_at timestamptz`, `scrub_out_at timestamptz`, `patient_name text`, `ip_number text` to `procedures`. Dashboard list shows a small "In progress" badge for `status = 'in_progress'`.
- Only one active in-progress case shown at a time (most recent).

## 5. Procedure names per category + presets (dashboard settings)

New page `/_authenticated/procedures-catalog` (linked from nav as "Catalog"):

- **Procedure names**: add/rename/reorder (drag & drop) entries grouped by category. Table `procedure_names(id, user_id, category, name, sort_order, preset_id nullable)`.
- **Presets**: create a preset with a name and a list of custom fields (label + type: text / number / textarea). Table `procedure_presets(id, user_id, name)` + `procedure_preset_fields(id, preset_id, label, field_type, sort_order)`.
- Assign a preset to one or many procedure names via a select on each procedure-name row (same window).
- On New log: when Category is chosen, Procedure name becomes a dropdown of saved names for that category (plus "Custom…"). When a procedure name with a preset is selected, an extra "Preset fields" section renders below Clinical detail with those custom inputs. Values stored on `procedures.preset_values jsonb`.
- Presets can also define default values for standard fields (surgical approach, default timed steps) stored in `procedure_presets.defaults jsonb`; applied on selection without overwriting user edits.

## 6. "Closed by" field on New log

- Add `closed_by text` column on `procedures`.
- New section at the bottom of the form ("Closure") with a single dropdown reusing the PA + surgeon lists combined (with "Add new" and auto-Dr. if picked from surgeons).

## 7. Category ordering

Already prioritized Cardiac surgery — no change unless you spot a gap.

## Technical details

- **Migration** (single call): add columns to `procedures` (`status`, `scrub_in_at`, `scrub_out_at`, `patient_name`, `ip_number`, `closed_by`, `preset_values jsonb default '{}'`); add `sort_order` to `team_surgeons`, `team_pas`; create `procedure_names`, `procedure_presets`, `procedure_preset_fields` with RLS scoped to `auth.uid()`, GRANTs to `authenticated` + `service_role`, and `updated_at` triggers where relevant.
- **procedures.ts**: extend `Procedure` type, add CRUD for procedure names, presets, preset fields, reorder helpers, `scrubIn`, `scrubOut`.
- **ProcedureForm**: new sections (Live times readonly if scrub_in_at present, Closure, Preset fields), procedure-name dropdown driven by selected category + `procedure_names`, dirty tracking + blocker.
- **Dashboard**: Live-case card + in-progress badge on the list; existing calendar/stats untouched.
- **Deps**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

## Out of scope

- Sharing catalogs/presets across users.
- Editing an already-completed case's scrub times.
- Advanced preset field types (dates, selects) — starting with text/number/textarea; easy to extend later.
