## 1. Fix the AI snapshot auto-fill

Findings from checking the AI request logs: **zero AI requests have ever reached the AI service** from this app. So the model isn't the problem — the request is dying before it gets there. The most likely cause is the image itself: the form reads the photo with `FileReader` and sends the *full-size* base64 data URL. A modern phone photo is 4–8 MB, which becomes ~6–11 MB of base64 and exceeds the server request-body limit, so the call fails before any model call happens.

Fixes:
- Downscale and compress the photo in the browser before sending: draw to a canvas, cap the long edge at ~1600px, export JPEG at ~0.75 quality (typically 200–500 KB). Also correct orientation and reject non-image files early.
- Surface the real error instead of a generic "Scan failed" toast — show the server's status/message so future failures are diagnosable.
- Add a visible progress state ("Compressing… → Reading image…") and block scanning while offline with a clear "Scanning needs internet" message (the rest of the app is offline-first).
- Verify the model id used for extraction against the current supported model list and switch to a current vision-capable model if needed.
- Then run one real end-to-end scan and confirm the request appears in the AI logs before calling it done.

Additional scan improvements:
- Let the scan also fill patient IP number, height/weight, and the closure/"closed by" name when visible.
- Show a small review step: list which fields the AI filled, with an Undo, so an incorrect read is easy to revert.
- Allow scanning multiple photos into the same log (front/back of a sheet).

## 2. Profile & Stats page

New `Profile` route in the top nav with the signed-in account and a full stats view, computed from local (offline-capable) data:

Headline numbers
- Total cases logged
- Total hours in case (sum of case durations, shown as `Xh Ym`)
- Average case duration
- Average cases per day / per week / per month (active-period based)
- Longest case, shortest case, busiest single day

Breakdowns
- Cases and hours by category (Cardiac surgery first), as a ranked bar list
- Top procedures by count
- Top surgeons and PAs worked with, by case count and hours
- Monthly trend chart (cases + hours per month, last 12 months)
- Re-exploration rate: how many cases had a re-exploration, plus total re-ex time
- Current streak / total active days

Filters: date-range selector (this month / 90 days / this year / all time) applied to the whole page, and an Export stats CSV button.

## 3. Suggested extras (included in this plan; tell me to drop any)

- **Milestones**: simple counters like "100 cardiac cases", "500 hours in case" with progress bars — useful for logbook/credentialing goals.
- **Dashboard summary strip**: cases this week, hours this week, and current streak surfaced at the top of the dashboard.
- **PDF logbook export**: printable case log for a date range (name, date, procedure, surgeon, role, duration) for portfolio/credentialing submissions.
- **Voice note → auto-fill**: dictate a short post-case summary and have it fill the same fields as the photo scan (reuses the AI path).

## Technical notes

- Image compression is a small client-side helper (`src/lib/image.ts`) used by the scan handler; no schema change.
- Stats are computed client-side from the existing Dexie/IndexedDB tables so the Profile page works offline; no new tables or migrations needed.
- Hours in case use `total_duration_seconds` when present, otherwise `scrub_out_at − scrub_in_at`, with re-exploration durations counted separately so they don't double-count.
- Charts use the chart components already in the project; no new dependencies except a PDF generator for the logbook export.
