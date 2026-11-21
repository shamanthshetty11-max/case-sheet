## Build the pre-op notes workflow

- After sign-in, show a choice between **Case log** and **Pre-op notes**; Case log opens the existing dashboard.
- Add an authenticated pre-op notes page with fields for name, age, weight, IP number, case, diagnosis, previous surgery, echo findings, CAG findings, and notes.
- Show the entered information in a clean A4 portrait document preview and let the user download it as a PNG image.
- Use a temporary, readable clinical layout until the user provides their preferred print format. Keep the pre-op content in the current page only; do not add patient-data persistence or database changes.

## Technical details

- Add authenticated file routes for the start choice and pre-op notes, and direct successful sign-in/opening flows to the choice page.
- Render the downloadable A4 image client-side from the form values; retain the existing case-log workflow unchanged.
- Record the route organization in `AGENTS.md`.