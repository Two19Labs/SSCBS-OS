import timetablesData from './timetables.json';

const PERIODS = [
  { id: 1, label: "Period I", start: "09:00", end: "10:00", startLabel: "9:00 AM", endLabel: "10:00 AM" },
  { id: 2, label: "Period II", start: "10:00", end: "11:00", startLabel: "10:00 AM", endLabel: "11:00 AM" },
  { id: 3, label: "Period III", start: "11:00", end: "12:00", startLabel: "11:00 AM", endLabel: "12:00 PM" },
  { id: 0, label: "Infinity Hour", start: "12:00", end: "13:00", startLabel: "12:00 PM", endLabel: "1:00 PM", isBreak: true },
  { id: 4, label: "Period IV", start: "13:00", end: "14:00", startLabel: "1:00 PM", endLabel: "2:00 PM" },
  { id: 5, label: "Period V", start: "14:00", end: "15:00", startLabel: "2:00 PM", endLabel: "3:00 PM" },
  { id: 6, label: "Period VI", start: "15:00", end: "16:00", startLabel: "3:00 PM", endLabel: "4:00 PM" },
  { id: 7, label: "Period VII", start: "16:00", end: "17:00", startLabel: "4:00 PM", endLabel: "5:00 PM" }
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function getTimetable(course, semester, section) {
  // Safe lookup with robust fallbacks
  const cData = timetablesData[course];
  if (!cData) return null;
  const sData = cData[semester];
  if (!sData) {
    // If exact semester not found, fallback to first available semester
    const firstSemKey = Object.keys(cData)[0];
    const firstSemData = cData[firstSemKey];
    const firstSecKey = Object.keys(firstSemData)[0];
    return firstSemData[section] || firstSemData[firstSecKey] || null;
  }
  const secData = sData[section];
  if (!secData) {
    // Fallback to section A or first available section
    const firstSecKey = Object.keys(sData)[0];
    return sData[firstSecKey] || null;
  }
  return secData;
}

export { PERIODS, DAYS };
