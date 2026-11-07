/**
 * SSCBS OS - Waiver Tool Parser
 * Master parser adhering to section 4 of the Waiver Tool specification.
 */

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Section 4.3 Regex:
// ^(P|A|Not Taken)(\|[^(]*)?\s*\(\s*(\w+)\s*\)$
export const ENTRY_REGEX = /^(P|A|Not Taken)(\|[^(]*)?\s*\(\s*(\w+)\s*\)$/i;

export function parseAttendanceEntry(raw) {
  const clean = String(raw || '').trim();
  if (!clean) return null;
  const match = clean.match(ENTRY_REGEX);
  if (!match) {
    throw new Error(`Unrecognized attendance entry: "${clean}". Parser stopped.`);
  }

  const status = match[1].toLowerCase();
  const typeRaw = match[3].toLowerCase();

  if (status === 'not taken') {
    return { ignore: true, raw: clean };
  }

  let type = typeRaw;
  if (typeRaw === 'th') type = 'th';
  else if (typeRaw === 'tu') type = 'tu';
  else if (typeRaw === 'pr' || typeRaw === 'prac') type = 'pr';
  else {
    throw new Error(`Unrecognized class type "${match[3]}" in entry: "${clean}".`);
  }

  return {
    ignore: false,
    raw: clean,
    attended: status === 'p',
    type // 'th' | 'tu' | 'pr'
  };
}

export function detectExcelFrameset(htmlText) {
  const lower = htmlText.toLowerCase();
  return (
    lower.includes('<frameset') ||
    lower.includes('progid content=excel.sheet') ||
    lower.includes('content="excel.sheet"') ||
    lower.includes('shlink')
  );
}

export function isTimetableFile(fileName) {
  const lower = (fileName || '').toLowerCase();
  return lower.includes('timetable') || lower.includes('time table') || lower.includes('schedule');
}

export function extractReportDate(text, fileName = '') {
  let year = new Date().getFullYear();
  let month = 11; // 1-12
  let day = 7;

  const textMatch = text && text.match(/REPORT ON\s+([\d]{4})-([\d]{2})-([\d]{2})/i);
  const fileMatch = fileName && fileName.match(/([\d]{4})-([\d]{2})-([\d]{2})/);
  const match = textMatch || fileMatch;

  if (match) {
    year = parseInt(match[1], 10);
    month = parseInt(match[2], 10);
    day = parseInt(match[3], 10);
  }

  return { year, month, day, dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

/**
 * Custom table level tokenizer that handles malformed ERP HTML where </td> comes before </table>
 */
export function extractOuterTableRows(htmlText) {
  const cleanHtml = htmlText.replace(/<!--[\s\S]*?-->/g, '');
  const firstTableIdx = cleanHtml.toLowerCase().indexOf('<table');
  if (firstTableIdx === -1) {
    throw new Error('No attendance <table> element found in file.');
  }

  const tableContent = cleanHtml.substring(firstTableIdx);
  let idx = 0;
  let tableLevel = 0;
  let insideOuterTr = false;
  let currentTr = '';
  const outerRows = [];

  while (idx < tableContent.length) {
    const sub = tableContent.substring(idx).toLowerCase();
    if (sub.startsWith('<table')) {
      tableLevel++;
      if (insideOuterTr) currentTr += tableContent.substr(idx, 6);
      idx += 6;
      continue;
    }
    if (sub.startsWith('</table>')) {
      tableLevel--;
      if (insideOuterTr) currentTr += tableContent.substr(idx, 8);
      idx += 8;
      continue;
    }
    if (tableLevel === 1 && sub.startsWith('<tr')) {
      insideOuterTr = true;
      currentTr = '<tr';
      idx += 3;
      continue;
    }
    if (tableLevel === 1 && insideOuterTr && sub.startsWith('</tr>')) {
      insideOuterTr = false;
      currentTr += '</tr>';
      outerRows.push(currentTr);
      idx += 5;
      continue;
    }
    if (insideOuterTr) {
      currentTr += tableContent[idx];
    }
    idx++;
  }

  return outerRows;
}

export function extractOuterCells(rowHtml) {
  const cells = [];
  let cIdx = 0;
  let tLevel = 0;
  let insideCell = false;
  let cellTag = '';
  let cellContent = '';

  while (cIdx < rowHtml.length) {
    const sub = rowHtml.substring(cIdx).toLowerCase();
    if (sub.startsWith('<table')) {
      tLevel++;
      if (insideCell) cellContent += rowHtml.substr(cIdx, 6);
      cIdx += 6;
      continue;
    }
    if (sub.startsWith('</table>')) {
      tLevel--;
      if (insideCell) cellContent += rowHtml.substr(cIdx, 8);
      cIdx += 8;
      continue;
    }
    if (tLevel === 0 && !insideCell && (sub.startsWith('<td') || sub.startsWith('<th'))) {
      insideCell = true;
      cellTag = sub.startsWith('<td') ? 'td' : 'th';
      cellContent = '';
      const tagEnd = rowHtml.indexOf('>', cIdx);
      cIdx = tagEnd !== -1 ? tagEnd + 1 : cIdx + 3;
      continue;
    }
    if (tLevel === 0 && insideCell && sub.startsWith(`</${cellTag}>`)) {
      insideCell = false;
      cells.push(cellContent.trim());
      cIdx += cellTag.length + 3;
      continue;
    }
    if (insideCell) {
      cellContent += rowHtml[cIdx];
    }
    cIdx++;
  }

  return cells;
}

/**
 * Main parser conforming to sections 4.1 to 4.6 of the master logic.
 */
export function parseAttendanceFile(htmlText, fileName = '') {
  // 1. Guard against timetable
  if (isTimetableFile(fileName)) {
    throw new Error(`It looks like you uploaded a Timetable file ('${fileName}') instead of your Attendance Report. Please upload your student attendance Excel sheet exported from the ERP portal.`);
  }

  // 2. Guard against Excel frameset
  if (detectExcelFrameset(htmlText)) {
    throw new Error('This file was re-saved from Excel. Download it again from the portal and upload it without opening it.');
  }

  // 3. Extract report date
  const { year: repYear, month: repMonth, day: repDay, dateStr: reportDateStr } = extractReportDate(htmlText, fileName);

  // 4. Extract rows
  const outerRows = extractOuterTableRows(htmlText);
  if (outerRows.length < 2) {
    throw new Error(`Invalid attendance table structure: only found ${outerRows.length} rows.`);
  }

  const headerCells = extractOuterCells(outerRows[0]).map(h => h.replace(/<[^>]*>/g, '').trim());
  if (headerCells.length < 5) {
    throw new Error('Header row does not contain sufficient columns (expected sno, Student, Roll No, dates..., Total Present, Total Absent).');
  }

  let totalPresentIdx = headerCells.findIndex(h => h.toLowerCase().includes('present'));
  let totalAbsentIdx = headerCells.findIndex(h => h.toLowerCase().includes('absent'));
  if (totalPresentIdx === -1) totalPresentIdx = headerCells.length - 2;
  if (totalAbsentIdx === -1) totalAbsentIdx = headerCells.length - 1;

  // Extract raw day numbers
  const rawDayCols = [];
  for (let c = 3; c < totalPresentIdx; c++) {
    const dayVal = parseInt(headerCells[c], 10);
    if (!isNaN(dayVal)) {
      rawDayCols.push({ colIdx: c, dayNum: dayVal });
    }
  }

  if (rawDayCols.length === 0) {
    throw new Error('Could not identify any attendance date columns in the header.');
  }

  // Section 4.5: Walk day columns BACKWARDS from the report date
  let curYear = repYear;
  let curMonth = repMonth; // 1-12
  const dayColsReversed = [];

  const lastCol = rawDayCols[rawDayCols.length - 1];
  if (lastCol.dayNum > repDay) {
    curMonth--;
    if (curMonth === 0) {
      curMonth = 12;
      curYear--;
    }
  }

  let prevDayNum = lastCol.dayNum;
  for (let i = rawDayCols.length - 1; i >= 0; i--) {
    const col = rawDayCols[i];
    if (col.dayNum > prevDayNum) {
      curMonth--;
      if (curMonth === 0) {
        curMonth = 12;
        curYear--;
      }
    }
    prevDayNum = col.dayNum;

    const dateStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(col.dayNum).padStart(2, '0')}`;
    const dateObj = new Date(Date.UTC(curYear, curMonth - 1, col.dayNum));
    const weekday = WEEKDAYS[dateObj.getUTCDay()];
    const monthLabel = MONTH_NAMES[curMonth - 1];

    dayColsReversed.push({
      colIdx: col.colIdx,
      dayNum: col.dayNum,
      year: curYear,
      month: curMonth,
      dateStr,
      weekday,
      label: `${col.dayNum} ${monthLabel}`,
      fullLabel: `${weekday} ${col.dayNum} ${monthLabel}`
    });
  }

  const dayColumns = dayColsReversed.reverse();

  // Parse subject rows
  const subjects = [];
  let rollNo = '';

  for (let r = 1; r < outerRows.length; r++) {
    const cells = extractOuterCells(outerRows[r]);
    if (cells.length < 3) continue;

    const subjectName = cells[1].replace(/<[^>]*>/g, '').trim();
    if (!subjectName) continue;
    const currentRoll = cells[2].replace(/<[^>]*>/g, '').trim();
    if (currentRoll && !rollNo) rollNo = currentRoll;

    let reportedP = parseInt(cells[totalPresentIdx]?.replace(/<[^>]*>/g, ''), 10);
    let reportedA = parseInt(cells[totalAbsentIdx]?.replace(/<[^>]*>/g, ''), 10);

    // Section 4.4: Last row totals formatting safeguard
    if (isNaN(reportedP) || isNaN(reportedA) || cells.length < totalAbsentIdx) {
      const numericCells = cells.map(c => parseInt(c.replace(/<[^>]*>/g, ''), 10)).filter(n => !isNaN(n));
      if (numericCells.length >= 2) {
        reportedA = numericCells[numericCells.length - 1];
        reportedP = numericCells[numericCells.length - 2];
      }
    }

    if (isNaN(reportedP)) reportedP = 0;
    if (isNaN(reportedA)) reportedA = 0;

    let totalP = 0;
    let totalA = 0;
    const partsStats = {
      th: { p: 0, a: 0 },
      tu: { p: 0, a: 0 },
      pr: { p: 0, a: 0 }
    };
    const dayClassesMap = {};

    dayColumns.forEach(d => {
      const cellHtml = cells[d.colIdx] || '';
      const innerTds = (cellHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
        .map(t => t.replace(/<[^>]*>/g, '').trim())
        .filter(Boolean);

      const dayList = [];
      innerTds.forEach(rawToken => {
        const parsed = parseAttendanceEntry(rawToken);
        if (!parsed.ignore) {
          dayList.push(parsed);
          if (parsed.attended) {
            totalP++;
            partsStats[parsed.type].p++;
          } else {
            totalA++;
            partsStats[parsed.type].a++;
          }
        }
      });

      if (dayList.length > 0) {
        dayClassesMap[d.dateStr] = dayList;
      }
    });

    // Section 4.4: Validation - Totals check
    if (reportedP !== totalP || reportedA !== totalA) {
      throw new Error(
        `Totals validation error for "${subjectName}": reported Present=${reportedP}, Absent=${reportedA}, but parsed Present=${totalP}, Absent=${totalA}. Parser stopped.`
      );
    }

    subjects.push({
      sno: cells[0].replace(/<[^>]*>/g, '').trim(),
      name: subjectName,
      rollNo: currentRoll,
      reportedP,
      reportedA,
      parsedP: totalP,
      parsedA: totalA,
      parts: partsStats,
      dayClasses: dayClassesMap
    });
  }

  if (subjects.length === 0) {
    throw new Error('No valid subject attendance rows could be parsed.');
  }

  return {
    reportDate: reportDateStr,
    rollNo,
    dayColumns,
    subjects
  };
}
