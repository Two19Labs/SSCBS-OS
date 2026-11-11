# Handoff: Attendance Tool — UI refresh

## What this is
`attendance-tool-prototype.html` is a **clickable design prototype** of the Attendance Tool (`src/components/WaiverToolPage.jsx` + `WaiverToolPage.css`). Open it in any browser; it is one self-contained file.

It is a **design reference, not production code**. Recreate the look in the existing React + Vite component and keep all real logic (parser, solver, marks engine, undo/redo, modals) as is. All numbers in the file are sample data from `src/test/fixtures/macro_starred_case.html`; the CDC state uses illustrative numbers.

Every style is inline on its element, so exact values can be read straight from the markup. The runtime script at the bottom of the file only makes the prototype clickable; do not port it.

## Click-through
1. Upload → click the drop zone (file chosen state) → **Analyse attendance**
2. Loading → Results with the **Not eligible** notice → **1/3rd rule** alert → dashboard
3. On the dashboard: **Expand grid** / Collapse, grid tool tabs, per-subject **credit pickers**, the 1/3rd notice link, **Replace sheet**, and the **CDC attendance** tile (+ / −) or **+ Add CDC days**, which switches the whole dashboard into its CDC state.

## What changed vs. the current UI
### 1. Status bar (replaces the single-line "N of 8 parts meet 85%" banner)
One card, five columns separated by 1px rules, tinted by status (amber `#fdfaf3` / border `#ecdcb8`; risk `#fdf6f6` / `#f2c9c9`):
- **Status** — 42px tinted icon tile, uppercase tone label, headline ("6 of 8 parts meet 85%"), one-line sub.
- **Parts on target** — `met/8`, one 8px segment per subject part coloured green ≥85, amber ≥66.7, red below; chips naming parts still short.
- **Internal marks** — total + gain chip; 8px bar: grey `#b8ab9b` = marks before waivers, green `#15803d` = waiver gain, blue `#0284c7` = CDC gain.
- **Waivers** — one 8px maroon bar filling `used/limit` (scales to any limit). With CDC the label becomes "Waivers + CDC" and the bar splits by limits: maroon waivers segment + blue CDC segment, with a two-item legend. Without CDC: "+ Add CDC days" link.
- **Action** — "Apply recommended" (maroon) or "✓ Recommended applied" (outline).

### 2. Subject card marks row (replaces the boxed "Internal Marks" bar + native credits dropdown)
- One line: `Marks 11 / 11 M +5.6 M` on the left; compact segmented **credits** control (`4C · 6M`, `GE/AEC · 4M`, `2C · 2M`) on the right — styled like the grid tool tabs.
- Under it a 5px bar split per component (flex-grow = component max marks): grey = before waivers, green = waiver gain, blue = CDC gain; tiny labels "Theory 6/6", "Tutorial 5/5".
- Fixes the duplicated "4 Credits · 6M" option.

### 3. CDC (Career Development Centre) state
CDC colour is the tool's existing sky blue (`#0284c7`, tint `#e0f2fe`, text `#0369a1`).
- CDC tile shows `3/3 dates`.
- Totals: "Ineligible for submission" becomes blue **"Rescued via CDC attendance"** when CDC lifts aggregate ≥ 66.7%.
- Each part helped by CDC gets a `+N CDC` pill; marks bars show the blue CDC segment.
- Grid: CDC dates get a blue date pill, `#f0f9ff` column, absences on those days shown as blue `P` chips; footer gets a "3 CDC" count and CDC key.
- Recommended dates: CDC days listed first with a blue date tile, a `CDC` tag and "· N covered".

## Tokens used (from `.rd-root`)
ink `#1e1a17` · muted `#5f5852` · faint `#8a8279` · line `#e6dfd4` · bg `#f7f3ec` · maroon `#7a1c28` / tint `#f6e7e9` · green `#15803d` / tint `#dcf2e3` · amber text `#b45309`, fill `#d97706`, tint `#fdeccf` · red `#b91c1c` / tint `#fbe1e1` · slate `#64748b` / tint `#e7ebf0` · track `#ece6dc` · CDC `#0284c7` / tint `#e0f2fe` / text `#0369a1`. Font: Manrope 400–800. Radii: cards 14–16px, buttons 10px, chips 999px.

Note: the expanded grid overlay in the prototype shows the no-CDC state only; apply the same CDC column styling there.
