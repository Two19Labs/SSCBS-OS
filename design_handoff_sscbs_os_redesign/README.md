# Handoff: SSCBS Campus OS — Design Overhaul

## Overview
A full visual redesign of SSCBS Campus OS (https://github.com/Two19Labs/SSCBS-OS) — the student portal with live class timetable, Find My Professor, Waiver Tool, GPA Calculator, notice board (Campus Buzz), PYQs (coming soon), and Profile. The redesign covers all mobile screens (light + dark) and the desktop app shell, in one consistent design language: **Manrope typeface, warm off-white surfaces, SSCBS crest maroon & gold accents**.

## About the Design Files
The bundled `SSCBS Campus OS Final.dc.html` is a **design reference created in HTML** — static mockups showing intended look, not production code. The task is to **recreate these designs in the existing codebase** (React + Vite, plain CSS files per component, Supabase auth) using its established patterns. Open the HTML in a browser to view all screens on a pan/zoom canvas (`support.js` and `assets/` must sit next to it).

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii and copy are final — recreate pixel-perfectly. All values are given below and are inline in the HTML (inspect any element to read its exact styles).

## Screen inventory (as laid out in the HTML, section id `t3`)
- **3a — Mobile, light (390px wide each):** Timetable, Find My Professor, Waiver Tool, GPA Calculator, Campus Buzz (notices), Profile
- **3b — Mobile, dark:** Home, Timetable (pattern applies to all screens)
- **3c — Desktop app shell (1180px):** persistent left sidebar + dashboard
- **3d — Design tokens card:** palettes, type scale, usage rules (also listed below)

## Navigation structure
- **Mobile:** bottom tab bar with 4 tabs — Home, Timetable, Tools, Profile. Tools (Find My Professor, Waiver, GPA, PYQs) open as full pages with a ← back button in the header. Active tab: filled maroon glyph + 800-weight label; inactive: 1.5px outlined glyph, dim color.
- **Desktop:** 224px fixed left sidebar (surface color, 1px right border): logo + wordmark, nav items (Home, Timetable, Find My Professor, Waiver Tool, GPA Calculator, PYQs w/ SOON pill, Campus buzz), then theme toggle and user identity pinned to the bottom. Active item: `rgba(113,34,44,.08)` background, maroon text, 10px radius.

## Design tokens

### Light theme
| Token | Value | Use |
|---|---|---|
| `--bg` | `#F7F3EC` | page background |
| `--surface` | `#FFFDF9` | cards, bars, sidebar |
| `--ink` | `#241A14` | primary text, dark buttons |
| `--ink-dim` | `#7A6D5F` | secondary text |
| `--ink-faint` | `#A89A90` | tertiary text, placeholders |
| `--maroon` | `#71222C` | primary actions, active nav, key numbers |
| `--gold` | `#B08D3E` | live/highlight accents (text on light uses `#8A6C2A`) |
| `--success` | `#0B7A54` | in-class dot, attendance OK |
| `--danger` | `#B91C1C` | sign out, errors |
| border | `rgba(36,26,20,.10)` | card borders (dashed for empty/coming-soon) |

### Dark theme
| Token | Value |
|---|---|
| `--bg` | `#181114` |
| `--surface` | `#231A1D` |
| `--ink` | `#F2E8E2` |
| `--ink-dim` | `#A89A90` |
| `--ink-faint` | `#7D716B` |
| `--gold` (becomes primary) | `#C9A558` |
| `--maroon` (lifted, labels only) | `#D98A94` |
| `--success` | `#57C896` |
| `--danger` | `#E57373` |
| border | `rgba(242,232,226,.10)` |

**Usage rules:** maroon = primary in light mode; gold takes over as primary in dark mode (maroon is too dark on dark surfaces). Never both accents on one element. One accent per card. Borders over shadows. No gradients, no emoji.

### Typography — Manrope (Google Fonts, weights 400 / 600 / 800)
| Role | Spec |
|---|---|
| Page title | 24–25px / 800, letter-spacing −0.02em |
| Screen header | 18px / 800 |
| Card title | 13–14px / 800 |
| Row label | 12.5px / 600 |
| Body | 11.5–12.5px / 400, dim color, line-height 1.5 |
| Micro label | 9–10px / 800, letter-spacing 0.09em, UPPERCASE |
| Big stat (SGPA, room no.) | 20–30px / 800, letter-spacing −0.02em |
| Time ranges | 10.5px / 600, `ui-monospace` stack |

### Shape & spacing
- Radii: cards **14px**, small tiles/controls **10px**, buttons **10–12px**, chips/day-pills **999px**, phone/desktop frame 16px
- Card padding 14–16px; screen gutter 20px; card gap 8–10px; section heading padding-top 20–24px
- Progress bars: 4–6px tall, track `rgba(ink,.08)`, fill maroon (light) / gold (dark)
- Active/current items: 1.5px accent border, or 3px left border + `rgba(gold,.10)` tint for timeline rows
- Mobile hit targets ≥ 44px

## Key components & behaviors
- **Live class card** (Home/Timetable/Desktop): green `● IN CLASS` micro label, countdown right-aligned in maroon/gold ("22m left", ticking), subject 18–22px/800, meta line (professor · room · time), progress bar of period elapsed, divider, "Next — …" row. Weekend state: swap for "No classes today" copy.
- **Timetable day tabs:** Mon–Fri equal-width pills; active = filled maroon (light) / gold (dark) with contrasting text. Past classes at 55–60% opacity with "done"; breaks are dashed-border rows.
- **Find My Professor:** search field (12px radius), highlighted professor card with 1.5px gold border, ROOM/FLOOR/ENDS stat tiles (gold-tinted ROOM), Today/Weekly segmented pills (active = ink-filled), timeline list with current row gold-tinted + 3px gold left border.
- **Waiver Tool:** maroon summary banner ("Apply 3 waivers to clear every subject"), recommended-date cards with calendar tile (day 14px/800 maroon + MON abbrev), effect copy ("lifts 81.2% → 86.1%"), "After waivers" bars with an 85% target tick mark (2px ink), dark re-upload button.
- **GPA Calculator:** SGPA (maroon card, inverted) + CGPA (surface card) stat pair, semester pills, course rows (name + scheme·credits) with grade chips (green tint for A+/O, neutral otherwise), dashed "+ Add course", formula footnote.
- **Campus Buzz:** filter chips (All/Event/Session/Society/Academic; active = ink-filled), notice cards with colored category micro label (EVENT maroon, SESSION gold-dark, SOCIETY green, ACADEMIC `#B45309`), date right, title, body, source; optional maroon "Register →" button.
- **Profile:** identity card (52px maroon avatar circle, name, email, class pill), grouped setting rows (Course/Semester/Section with maroon value + ›), Light/Dark/System segmented control, ADMIN group containing Admin console link and the **Time-warp simulator toggle (admin-only — hidden for regular users; replaces the old public "Show Time Warp Controls")**, danger-bordered Sign out.
- **Theme toggle:** in Profile (mobile) and sidebar footer (desktop). Persist choice; "System" follows `prefers-color-scheme`.
- **Footer credit:** "Made with ♥ by Two19 Labs" (10px, faint) on Home/Profile/desktop buzz column.

## State & data (already in the codebase — visual layer only)
Existing logic to keep: IST clock ticking per second, timetable from `src/data/timetables.json`, Supabase auth + user metadata (course/semester/section), waiver solver, GPA schemas, admin whitelist. Map current CSS files (`App.css`, `ClassSchedulesCard.css`, etc.) to the new tokens — ideally replace the `:root` block in `src/index.css` with the light tokens and add a `[data-theme="dark"]` block.

## Assets
- `assets/sscbs_logo.png` — SSCBS crest (from `public/sscbs_logo.png` in the repo), used at 26–28px in headers/sidebar.
- Nav glyphs in the mockups are geometric placeholders (squares/circles) — substitute a consistent 1.5px-stroke icon set (e.g. Lucide) at 18px, filled variant for active state.

## Files
- `SSCBS Campus OS Final.dc.html` — all screens (open in a browser; pan/zoom canvas)
- `support.js` — runtime the HTML needs to render (keep beside it)
- `assets/sscbs_logo.png` — crest logo
