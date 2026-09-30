# SSCBS Campus OS: mobile redesign

**For Antigravity. Read this file first, then open the design.**

## 1. What you're building
Give the phone layout (screens up to 899px wide) of the existing React + Vite app the new look.

- **The design:** `SSCBS Mobile Definitive.dc.html`. Open it in a browser, with `support.js` and `assets/` kept next to it. It has 25 numbered phone screens (01–25).
- **Exact values:** every color, size and spacing is written inline in that file. Inspect any element to get the number.
- **What changes:** layout and styling only. The app's features, data and logic stay exactly as they are.

## 2. Rules (don't break the app)
1. **Keep the hamburger + drawer.** Do NOT add a bottom tab bar.
2. **Don't change logic.** Keep every handler, prop, state variable, effect, Supabase call, analytics call (`track*`, `log*`), feature flag and access check (`canAccess*`, `isAdmin*`). If you move a button, move its `onClick` with it unchanged.
3. **Only phones change.** Put new CSS inside `@media (max-width: 899px) { … }`. Desktop must look the same.
4. **Use existing colors only.** They are the CSS variables in `src/index.css`. Dark mode must keep working.
5. **No new npm packages.**
6. **Kill switch.** Create `src/lib/uiFlags.js` with `export const MOBILE_V2 = true;`. Wrap new mobile-only JSX in `MOBILE_V2 && isMobile`. Setting it to `false` must bring back the old phone UI.
7. **One phase at a time** (§6). After each phase run `npm run build` and `npm run lint`, then check that the features listed for that phase still work.
8. **If something would need a logic change, don't do it.** Keep the current behaviour and leave a `// TODO(mobile-v2):` comment.

Create `src/hooks/useIsMobile.js`:
```js
import { useEffect, useState } from 'react';
const Q = '(max-width: 899px)';
export function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(Q).matches);
  useEffect(() => {
    const mq = window.matchMedia(Q); const on = () => setM(mq.matches);
    mq.addEventListener('change', on); return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}
```

## 3. Design basics (used everywhere)
- **Font:** Manrope, which is already loaded.
- **Colors:** background `--bg`, cards `--surface`, text `--ink` / `--ink-dim` / `--ink-faint`, primary `--accent`, highlight `--gold` / `--gold-text` / `--gold-tint`, live and OK states `--success`, errors `--danger`, borders `--border` / `--border-strong`, light fills `--tint`.
- **Sizes:**
  - Page side padding 20px.
  - Every tappable thing at least **44px** tall.
  - Card radius 14–16, button radius 10–12, chips fully rounded.
- **Text styles:**

  | Role | Style |
  |---|---|
  | Page title (app bar) | 17px/800 |
  | Big headings | 22–26px/800, letter-spacing −0.02em |
  | Card titles | 14–15px/800 |
  | Body | 12.5px in `--ink-dim` |
  | Small labels | 10px/800, UPPERCASE, letter-spacing .09em |
  | Times | `--mono` |

- **Remove:** all gradients, pulsing/shimmer animations, and emoji in buttons and labels (📅 👥 🧪 🍽️ ☕ 📢 🟢 🔴 🔒 etc.). Replace emoji with icons from `components/icons.jsx` or plain text.
- **Borders, not shadows.** The only shadow is on floating buttons (FABs).

## 4. Shared pieces to build first
| Piece | Where | Looks like |
|---|---|---|
| **App bar** | `App.jsx` `.app-topbar` | 56px tall. Left: menu button (44×44). Middle: page title (on Home: logo + "SSCBS OS"). Right: one action (bell, export, "Saved", etc.). Border appears only after scrolling. |
| **Drawer** | `App.jsx` `.app-sidebar-mobile` | Screen **04**. 318px wide with rounded right corners. Profile card at the top. Groups: Main (Home, **Timetable**, Campus Buzz) · Academic & Tools · Community · Admin. Contact + Light/Dark toggle in the footer. Rows 44px. Locked items grey with a SOON pill. LIVE shown as small green text. Closes on backdrop tap, Esc or swipe left. |
| **BottomSheet** | new `components/BottomSheet.jsx` | Screens **10, 16, 18, 02**. Slides up from the bottom, rounded top corners, grab handle, dark backdrop, closes on backdrop, Esc or drag down. Props: `open, onClose, title, fullHeight`. |
| **Chips** | CSS | 36px tall, rounded. Active = `--ink` fill with light text. |
| **Segmented control** | CSS | Grey track with 2–3 buttons (40px). Active = `--ink` fill. |
| **Settings list** | CSS | One card with rows ≥ 48px, a thin divider between rows, and value + › on the right. |

## 5. Screen by screen
Each row is a screen number from the design → the file to change → what to do. Keep all existing logic.

| # | Screen | File(s) | What to do |
|---|---|---|---|
| 01 | Sign in | `Auth.jsx/.css` | One column. Sign in / Create account as a segmented control. 48px inputs. Big primary button. Feature tiles below. |
| 02 | First-run setup | `ProfileModal.jsx` | Show as a bottom sheet. Course = segmented, semester = chips, section = 4 squares. Same state and save. |
| 03 | Home | `HomeDashboard.jsx/.css` | Order: date line, greeting, live card, 1-line disclaimer, **Quick tools** (4 icon tiles), Campus Buzz preview (2 cards, "See all"). Live card: solid progress bar, 2 buttons "Full timetable" (→ `timetable`) + "Other sections". Hide the inline timeline and tools grid on mobile. Keep every live-card state. |
| 04 | Drawer | `App.jsx` | See §4. Add a `timetable` item. |
| 05 | Notifications | `NotificationCenter.jsx/.css` | On mobile, open as a full screen instead of a dropdown: filter chips, list rows, Accept/Decline buttons, device-notification toggle pinned at the bottom. |
| 06 | Timetable (**new**) | new `TimetablePage.jsx` + add `'timetable'` to `VALID_VIEWS` in `App.jsx` | Section pill (opens Other sections), Mon–Fri day pills, vertical list of periods. Current period gold-highlighted with a progress bar, past ones faded, breaks dashed, G1/G2 on separate lines. Use helpers from `utils/timetableSchedule.js`. Export button in the app bar. |
| 07 | Other sections | `OtherSectionsModal.jsx/.css` | Full-screen on mobile. Course = segmented, sem = chips, section = squares, Right now / Full week = segmented. Same state and logic. |
| 08 | Find My Professor | `FindMyProfessorPage.jsx/.css` | One screen, no list/detail switching. Search box with results dropdown. Status card with ROOM / FLOOR / ENDS tiles. Today / This week segmented. Weekly table becomes a day list on mobile. Long disclaimer becomes 1 line + "Details" (sheet). |
| 09 | Classroom Radar | `EmptyRoomFinderPage.jsx/.css` | Live now / Pick a slot segmented. Summary card (free and in-class counts). Search. Chips: Vacant, In class, Floor. Rooms as list rows. Replace the emoji pills. |
| 10 | Room schedule | same | Room tap opens the day timeline in a bottom sheet (the current modal, restyled). |
| 11 | GPA — SGPA | `GpaCalculatorModal.jsx/.css` | On mobile, full page (not modal). SGPA/CGPA segmented, semester chips S1–S8, maroon result card, one row per subject with a ‹ grade › stepper, pinned bottom bar "+ Subject" / "Add to CGPA". Same calculations and localStorage. |
| 12 | GPA — CGPA | same | Two result tiles + a list of semesters with checkboxes, SGPA and credits. Formula note. |
| 13 | Waiver — setup | `WaiverToolPage.jsx/.css` | Use the normal app bar (drop the "Back to Campus OS" navbar on mobile). A "Your limits" list with steppers, dashed upload box, file row, pinned "Find best waivers" button. |
| 14 | Waiver — results | same | Maroon summary card, Dates / Subjects / Calendar segmented, recommended date cards, after-waiver bars with an 85% tick, pinned "Clear all" / "Apply recommended". |
| 15 | Campus Buzz | `NoticeBoard.jsx/.css` | Full-page feed, no inner scroll box. Sticky category chips (filter already-loaded notices by `category`). Cards: category label, title, time + venue, body, society + 40px link button. "Draft notice" floating button for approved drafters. |
| 16 | Draft notice | same | The draft modal becomes a full-height bottom sheet. Quick paste at the top, one-column form, pinned submit. |
| 17 | Competitions | `CaseCompsPage.jsx/.css` | Search, "Filters" chip + removable active-filter chips, count line, cards with deadline, tags, "Find teammates" / "Open on Unstop". |
| 18 | Competition filters | same | Move the left filter sidebar into a bottom sheet: Circuit chips, Track chips, Format and Fee segmented, pinned "Show N competitions". |
| 19 | Team Finder | `TeamFinderPage.jsx/.css` | Open teams / My posts segmented, search, cards (spots left, skills, poster, "Request to join"), "Post an opening" floating button. Existing modals become sheets. |
| 20 | Societies | `SocietyTrackerPage.jsx/.css` | Search, domain chips, list rows. Tapping a row expands its contacts with WhatsApp / Instagram buttons. |
| 21 | Faculty Directory | `FacultyDatabasePage.jsx/.css` | Search, Permanent / Guest segmented, A–Z list. Selected card shows Email / Copy / "Where now" (→ Find My Professor). |
| 22 | Profile | `ProfilePage.jsx/.css` | Hide its own header (app bar shows "Profile" + save status). Identity card, settings lists, Course/Sem/Section open sheets, theme segmented, drafter access as one row → sheet, full-width Sign out. |
| 23 | Contact | `ContactPage.jsx/.css` | Title + 4 topic buttons (no emoji), message box, green "Open WhatsApp", info rows. |
| 24 | PYQs | route for `pyqs` | Simple "Coming soon" page (only reachable when unlocked). |
| 25 | Admin console | `AdminConsolePage.jsx/.css` | On mobile, show a list of sections (Notices, Timetable, Blocked dates, Students, Societies) + app on/off switches. Each opens its existing panel full-screen. |

## 6. Order of work (one PR each)
Test each phase at 360, 390 and 430px wide and on desktop, in light and dark mode.

1. **Foundations:** `uiFlags.js`, `useIsMobile.js`, shared CSS, remove gradients/animations/emoji.
   Check: desktop is unchanged.
2. **App bar + Drawer** (04).
   Check: every drawer item opens the right page; locked and hidden items behave as before; the bell still works.
3. **BottomSheet** component.
   Check: the build passes.
4. **Home** (03) + **Timetable** (06) + **Other sections** (07).
   Check: every live-card state (admin time-warp: weekday class, break, evening, weekend, holiday); `#timetable` works directly; export works.
5. **Buzz** (15, 16) + **Notifications** (05).
   Check: notices load, filters work, mark-read works, drafting and publishing work, team Accept/Decline works.
6. **Find My Professor** (08) + **Classroom Radar** (09, 10).
   Check: search, status and export work; live and slot modes work.
7. **GPA** (11, 12) + **Waiver** (13, 14).
   Check: numbers match the old version; saved data persists; upload and recommendations work.
8. **Competitions, Team Finder, Societies, Faculty** (17–21).
   Check: all filters, posting, applying and prefill work.
9. **Profile, Contact, Sign in, Setup, PYQs, Admin** (01, 02, 22–25).
   Check: auto-save, theme, drafter request, sign out, login and signup, password reset, and admin tools all work.

## 7. Done when
- [ ] The phone layout matches the 25 screens. There is no bottom tab bar.
- [ ] Every existing feature still works.
- [ ] Nothing tappable is smaller than 44px, and nothing scrolls sideways except chip rows.
- [ ] No emoji or gradients in the interface. Dark mode looks right.
- [ ] Desktop is unchanged.
- [ ] Setting `MOBILE_V2 = false` restores the old phone UI.
- [ ] `npm run build` and `npm run lint` pass.

## 8. Prompt to paste into Antigravity (one per phase)
> Read `handoff/README.md`. Do **Phase N only**. Follow the rules in §2 strictly: no logic changes, and CSS only inside `@media (max-width: 899px)`. Open `handoff/SSCBS Mobile Definitive.dc.html` in a browser to match screens #… exactly. When done, run `npm run build` and `npm run lint`, and tell me how you checked each item in that phase's "Check".
