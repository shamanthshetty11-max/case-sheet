## Goal

CaseSync becomes installable on your phone (home-screen icon, full screen) and downloadable as a desktop program, and it keeps a **complete copy of all your data on the device**. You can open it, browse everything, and log/edit cases with no internet; changes upload automatically the moment you're back online.

## 1. Local database on the device

Add an on-device database (IndexedDB via Dexie) mirroring every table the app uses: procedures, steps, re-explorations, procedure names, presets, preset fields, surgeons, PAs, surgical approaches.

- On sign-in and on every app open with connectivity, pull all rows for the signed-in user into the local copy.
- After the first sync, screens read from the local copy first, so the app opens instantly and works with no signal.
- Data is scoped per user id and cleared on sign-out.

## 2. Writes work offline (outbox + sync)

Every create/update/delete goes to the local copy immediately and is appended to a pending-changes queue.

- IDs are generated on the device (UUID) so new logs, steps and catalog entries exist offline right away and keep the same id after upload.
- A background sync flushes the queue when online: on app start, when the network returns, and periodically while open.
- Conflicts: last-write-wins per record using an `updated_at` comparison; the device's pending change wins over an older server row. A record that fails repeatedly is surfaced in the sync panel instead of being silently dropped.
- Header shows a small status chip: **Online / Offline / Syncing / N pending**, with a manual "Sync now" action.

## 3. Offline behaviour of specific features

- **Scrub-in / scrub-out / Re-ex timers**: fully offline; times recorded locally and synced later.
- **AI "Scan image"**: needs internet (it calls a hosted model). Offline it shows a clear "needs connection" message; the photo can still be attached and scanned later.
- **File attachments**: files picked offline are stored in the local database and uploaded to cloud storage when connectivity returns. Previously downloaded attachments are cached for offline viewing.
- **CSV export**: works offline from the local copy.

## 4. Installable phone app (PWA)

- Web app manifest with CaseSync name, tagline, theme colours matching the dark theme, standalone display, and app icons generated from the CaseSync logo (192/512 + maskable + Apple touch icon).
- Service worker via `vite-plugin-pwa` (`generateSW`, `autoUpdate`) with a guarded registration wrapper: never registers in the Lovable editor preview, in an iframe, in dev, or with `?sw=off`. Page navigations use network-first; only hashed build assets are cached first.
- Result: "Add to Home Screen" on iPhone/Android gives an app icon that launches full screen and opens without internet.
- Note: offline mode only takes effect on the published site, not inside the editor preview.

## 5. Desktop app

Package the same app with Electron:

- `electron/main.cjs` (context isolation on), `base: './'` in the Vite config, packaged with `@electron/packager`.
- Builds produced for Windows (`.zip`), macOS (`.zip`) and Linux (`.tar.gz`), downloadable from the documents output.
- The desktop build uses the same local database and sync engine, so it also works fully offline.

## Technical details

- New `src/lib/local-db.ts` (Dexie schema + per-user scoping), `src/lib/sync.ts` (pull, outbox flush, network listeners, status store), `src/hooks/use-sync-status.ts`.
- `src/lib/procedures.ts` is rewritten to read/write through the local layer instead of calling Supabase directly, keeping the same exported function signatures so the existing screens and forms are untouched apart from the status chip.
- Migration adds an `updated_at` column (with trigger) to the tables that lack one, so conflict resolution and incremental pull work: `procedure_steps`, `procedure_names`, `procedure_preset_fields`, `surgical_approaches`, `team_surgeons`, `team_pas`, `procedure_reexplorations`, `procedure_attachments`. Also a `deleted_at` soft-delete column on the same tables plus `procedures`, so deletions propagate between devices instead of rows reappearing on the next pull.
- Auth: session tokens are already persisted locally, so the app stays signed in offline; the protected-route gate is adjusted to accept a cached session when the network is unreachable rather than bouncing to the sign-in page.
- `vite-plugin-pwa` added; `public/manifest.webmanifest` + icons; registration only from the guarded wrapper.

## Out of scope

- App Store / Play Store native builds (this is web installability + desktop packaging).
- Multi-device real-time collaboration (sync is periodic, not live).
- Offline AI scanning.
