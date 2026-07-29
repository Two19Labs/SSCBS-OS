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

### Step 1: Execute Initial & Room Expansion Audit Script
Run an automated audit on `src/data/timetables.json` to process every course, semester, section, and period slot:
1. **Faculty Initials Resolution**:
   - `AA` ➔ `Dr. Anamika Agarwal`
   - `AG` / `AyG` ➔ `Ayushi Goel`
   - `DD` ➔ `Dr. Deepali Dhaka`
   - `AM` ➔ `Dr. Amit Kumar`
   - `TA` ➔ `Dr. Tarannum Ahmad`
   - `MV` / `MN` ➔ `Dr. Mona Verma`
   - `SJ` / `SKG` ➔ `Dr. Shikha Gupta`
   - `SK` / `PS` ➔ `Mr. Praveen SK`
   - `KR` / `KRS` ➔ `Dr. Kavita Rastogi`
   - `OS` ➔ `Onkar Singh`
   - `NG` ➔ `Neha Gupta`
   - `NB` ➔ `Dr. Neha Bhatia`
   - `ST` ➔ `Sonika Thakral`
   - `MA` / `MR` ➔ `Ms. Mohini Rajput`
   - `Azmi` ➔ `Dr. Azmi Ashraf`
   - `AV` ➔ `Abhimanyu`
   - `PA` ➔ `Dr. Preeti Rajpal`
   - `MT` ➔ `Dr. Madhu Totla`
   - `SV` ➔ `Shikha Verma`
   - `NKS` ➔ `Dr. Nidhi Kesari`
   - `TM` ➔ `Mr. Tushar Marwaha`
   - `Komal` ➔ `Mr. Komal`
   - `Garima` ➔ `Dr. Garima Tripathi`
   - `Seema` ➔ `Dr. Seema`
   - `Paridhi` ➔ `Ms. Paridhi`

2. **Room String Normalization**:
   - `Hin A / Hin C / Hin D` ➔ `Room 607 / Room 644 / Room 648`
   - `Hin A` / `Hindi A` ➔ `Room 607` (Dr. Garima Tripathi)
   - `Hin B` / `Hindi B` ➔ `Room 607` (Dr. Garima Tripathi)
   - `Hin C` / `Hindi C` ➔ `Room 644` (Dr. Soumya Guliyan)
   - `Hin D` / `Hindi D` ➔ `Room 648` (Mr. Komal)

3. **3-Digit Room Extraction & Subject/Teacher Cleaning**:
   - If a 3-digit room number (e.g. `648`, `607`, `703`, `361`, `534`, `523`, `651`, `326`) is embedded inside teacher or subject text (e.g. `Komal 648`, `Garima 607`, `Vinayak (648/326)`, `MV (361/326)`, `Ankit (523/651)`, `AM (534)`), extract it into `room` as `Room XXX` and strip it from display text.
   - Clean subjects where teacher initials were put in subject field (e.g. `G1: Seema | G2: Social and Emotional Learning` ➔ subject: `Social and Emotional Learning`).

### Step 2: Cache Invalidation (Version Bump)
- Increment `CURRENT_TIMETABLE_VERSION` in `src/context/TimetableContext.jsx` to force browser `localStorage` cache invalidation across all user sessions.

### Step 3: Build & Verification
- Run `cmd /c "npm run build"` to verify zero syntax or bundling errors.

### Step 4: Commit & Push to GitHub
- Stage files: `git add .`
- Commit: `git commit -m "fix: run automated timetable cleanup routine and bump cache version"`
- Push: `git push origin main`
