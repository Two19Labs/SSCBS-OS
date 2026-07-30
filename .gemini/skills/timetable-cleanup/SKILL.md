# Master Timetable Cleanup & Parsing Skill

This skill defines the authoritative, deterministic routine for parsing, auditing, cleaning, and publishing SSCBS official Excel timetables into `src/data/timetables.json`.

## When to Run This Skill
Activate this routine whenever new Excel timetables are uploaded or when the user says:
- "clean up the timetable"
- "parse the new Excels"
- "I've uploaded new Excels, clean it up"
- "run the timetable cleanup skill"

---

## 🛠️ Master Architecture & Rules

### 1. Deterministic Node.js Parser (`scripts/parse_official_excels.cjs`)
Never use LLM / Hugging Face completion APIs for timetable parsing. Always run the deterministic Node.js parser script using the `xlsx` library.

### 2. Exact Grid Column Index Map
In the official SSCBS Excel sheets, row 9/10 contains 8 period columns. **Column 4 (Index 4 of period cells, 12:00 PM – 1:00 PM) is an unmerged empty cell for Infinity Hour and MUST BE SKIPPED:**
- `colIdx 1` ➔ Period 1 (09:00 AM – 10:00 AM)
- `colIdx 2` ➔ Period 2 (10:00 AM – 11:00 AM)
- `colIdx 3` ➔ Period 3 (11:00 AM – 12:00 PM)
- **`colIdx 4` ➔ Infinity Hour (12:00 PM – 1:00 PM) [ALWAYS SKIP IN GRID LOOP]**
- `colIdx 5` ➔ Period 4 (01:00 PM – 02:00 PM)
- `colIdx 6` ➔ Period 5 (02:00 PM – 03:00 PM)
- `colIdx 7` ➔ Period 6 (03:00 PM – 04:00 PM)
- `colIdx 8` ➔ Period 7 (04:00 PM – 05:00 PM)

### 3. Semester Extractor Regex
Use `/Sem\s*:?\s*(\d+)(?:st|nd|rd|th)?/i` to extract semester numbers.
*Gotcha*: Avoid `/(\d+)(?:st|nd|rd|th)?\s*Sem/i` first, as `Year 2nd Sem 3rd` will incorrectly match `2nd Sem` and capture Year `2` instead of Semester `3`.

### 4. Section Default Room Fallbacks
If a period cell does NOT contain an explicit 3-digit room number, fall back to the section's default room header:
- `BMS Sem 1, 3, 5` ➔ `Room 703`
- `BMS Sem 7` ➔ `Room 523`
- `BBA FIA Sem 1, 3, 5A` ➔ `Room 503`
- `BBA FIA Sem 5B` ➔ `Room 507`
- `BBA FIA Sem 7` ➔ `Room 533`
- `B.Sc. Comp Sci Sem 1` ➔ `Room 403`
- `B.Sc. Comp Sci Sem 3` ➔ `Room 407`
- `B.Sc. Comp Sci Sem 5` ➔ `Room 457`
- `B.Sc. Comp Sci Sem 7` ➔ `Room 435`

### 5. Legend Table Extraction (Subject & Teacher Mapping)
Every section block in the Excel sheet contains a Legend Table at the bottom:
- **BMS / BBA FIA**: `S. No. | Paper Type | Paper Name | Faculty Name | Faculty Code`
- **B.Sc. Comp Sci**: `Course Type | Course Name | Course Code | Faculty Name | Faculty Code`
Extract `Paper Name` and `Faculty Name` for every code/initial to populate full subject titles (e.g. `TA` ➔ `Fundamentals of Management`, `AM` ➔ `Organizational Behaviour` / `Data Structures`, `RRS` ➔ `Introduction to Business Analytics`).

### 6. Split Cells & Multi-Group Support (`/`)
Cells containing `/` (e.g. `G1: AM (534) / G2: MV (361)` or `Garima (Hin A) 607 / Soumya (Hin C) 644 / Komal (Hin D) 648`):
1. Split into components by `/`.
2. Extract group prefixes (`G1:`, `G2:`).
3. Extract 3-digit rooms (`607`, `644`, `648`, `534`, `361`, `237`, `337`, `523`, `651`, `Lab 460`, `Lab 426`).
4. Resolve teacher names and paper titles for each component.
5. Format deduplicated `subject`, `teacher`, and `room` strings.

### 7. Execution Checklist & Deployment Routine
1. Run `node scripts/parse_official_excels.cjs`.
2. Verify `src/data/timetables.json` structure (`BMS`, `BBA FIA`, `Bsc Comp Sci` keys for Sems `1`, `3`, `5`, `7`).
3. Increment `CURRENT_TIMETABLE_VERSION` in `src/context/TimetableContext.jsx` to invalidate client `localStorage` caches.
4. Run `cmd /c "npm run build"` to verify zero syntax/bundling errors.
5. Stage, commit, and push live:
   ```bash
   git add .
   git commit -m "feat: parse official Excel timetables and run cleanup routine"
   git push origin main
   ```

