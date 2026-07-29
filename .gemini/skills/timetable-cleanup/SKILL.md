---
name: timetable-cleanup
description: Comprehensive automated post-processing routine for cleaning SSCBS timetables, expanding faculty initials, resolving 3-digit room allocations, filtering non-faculty elective entries, and syncing clean data to GitHub.
---

# Timetable Cleanup Skill

This skill defines the standard automated routine for auditing and cleaning SSCBS timetables after new Excel sheets are uploaded via the Admin Console's AI Parser.

## When to Run This Skill
Run this skill whenever the user says:
- "clean up the timetable"
- "I've uploaded new Excels, clean it up"
- "audit the timetable"
- "run the cleanup routine"

## Routine Execution Steps

### Step 1: Execute Initial & Room Expansion Script
Run an automated audit on `src/data/timetables.json` to process every course, semester, section, and period slot:
1. **Faculty Initials Resolution**:
   - `AA` ➔ `Dr. Anamika Agarwal`
   - `AG` / `AyG` ➔ `Ayushi Goel`
   - `DD` ➔ `Dr. Deepali Dhaka`
   - `AM` ➔ `Dr. Amit Kumar`
   - `TA` ➔ `Dr. Tarannum Ahmad`
   - `MV` ➔ `Dr. Mona Verma`
   - `SJ` ➔ `Dr. Shikha Gupta`
   - `SK` / `PS` ➔ `Mr. Praveen SK`
   - `KR` ➔ `Kavita Rastogi`
   - `OS` ➔ `Onkar Singh`
   - `NG` ➔ `Neha Gupta`
   - `NB` ➔ `Dr. Neha Bhatia`
   - `ST` ➔ `Sonika Thakral`
   - `MA` ➔ `Ms. Mohini Rajput`
   - `MN` ➔ `Dr. Mona Verma`
   - `Azmi` ➔ `Dr. Azmi Ashraf`

2. **Room String Normalization**:
   - `Hin A / Hin C / Hin D` ➔ `Room 607 / Room 644 / Room 648`
   - `Hin A` ➔ `Room 607`
   - `Hin B` / `Hindi B` / `Hin C` ➔ `Room 644`
   - `Hin D` ➔ `Room 648`

3. **3-Digit Room Extraction**:
   - If a 3-digit room number (e.g. `648`, `607`, `703`, `361`, `534`, `523`, `651`, `326`) is embedded inside teacher or subject text (e.g. `Komal 648`, `Garima 607`, `Vinayak (648/326)`), extract it into `room` as `Room XXX` and strip it from the display text.

### Step 2: Cache Invalidation (Version Bump)
- Increment `CURRENT_TIMETABLE_VERSION` in `src/context/TimetableContext.jsx` to force browser `localStorage` cache invalidation across all user sessions.

### Step 3: Build & Verification
- Run `cmd /c "npm run build"` to verify zero syntax or bundling errors.

### Step 4: Commit & Push to GitHub
- Stage files: `git add .`
- Commit: `git commit -m "fix: run automated timetable cleanup routine and bump cache version"`
- Push: `git push origin main`
