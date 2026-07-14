import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useTimetable } from '../context/TimetableContext';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import './AdminConsolePage.css';

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const FULL_DAYS = {
  "Mon": "Monday",
  "Tue": "Tuesday",
  "Wed": "Wednesday",
  "Thu": "Thursday",
  "Fri": "Friday"
};

// Course subjects database for CS fallbacks
const csSubjects = {
  2: [
    { name: "Data Structures", code: "Core" },
    { name: "Discrete Mathematical Structures", code: "Core" },
    { name: "Computer System Architecture", code: "Core" },
    { name: "GE - Numerical Methods", code: "GE" },
    { name: "SEC - Web Design and Development", code: "SEC" },
    { name: "VAC - Digital Empowerment", code: "VAC" }
  ],
  4: [
    { name: "Design & Analysis of Algorithms", code: "Core" },
    { name: "Database Management Systems", code: "Core" },
    { name: "Computer Networks", code: "Core" },
    { name: "DSE - Artificial Intelligence", code: "DSE" },
    { name: "SEC - Programming with Python", code: "SEC" },
    { name: "VAC - Cyber Security", code: "VAC" }
  ],
  6: [
    { name: "Software Engineering", code: "Core" },
    { name: "Operating Systems", code: "Core" },
    { name: "Theory of Computation", code: "Core" },
    { name: "DSE - Machine Learning", code: "DSE" },
    { name: "GE - Data Science using R", code: "GE" }
  ],
  8: [
    { name: "Information Security", code: "Core" },
    { name: "DSE - Cloud Computing", code: "DSE" },
    { name: "DSE - Internet of Things (IoT)", code: "DSE" },
    { name: "SEC - Capstone Project", code: "SEC" }
  ]
};

const csTeachers = ["Dr. Mona Verma", "Dr. Amit Kumar", "Dr. Tarannum Ahmad", "Mr. Tatkarsh", "Dr. Narander Kumar Nigam", "Ms. Monika"];
const csRooms = ["Room 651", "Room 644", "Room 326", "Room 237"];

export default function AdminConsolePage({ onBack }) {
  const { timetable, updateTimetable } = useTimetable();
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'editor', 'notices'
  
  // Notices manager states
  const [noticesList, setNoticesList] = useState([]);
  const [loadingNotices, setLoadingNotices] = useState(false);
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    category: 'Event',
    society: '',
    content: '',
    link_url: ''
  });

  const fetchAdminNotices = async () => {
    if (!hasValidCredentials) {
      setNoticesList([
        {
          id: '1',
          title: 'HackSSCBS 2026 Registration Open',
          category: 'Event',
          society: 'Kronos',
          content: 'Register for the premier hackathon of SSCBS. Open to all students. Cash prizes up for grabs!',
          link_url: 'https://hacksscbs.tech',
          created_at: new Date().toISOString()
        }
      ]);
      return;
    }
    try {
      setLoadingNotices(true);
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching admin notices:', error);
        if (error.message && error.message.includes('schema cache')) {
          setSaveStatus({
            type: 'error',
            message: "The 'notices' table does not exist in your Supabase database. Please run the SQL migration in your Supabase SQL Editor to create it."
          });
        } else {
          setSaveStatus({ type: 'error', message: error.message || 'Failed to load notices.' });
        }
      } else {
        setNoticesList(data || []);
      }
    } catch (err) {
      console.error('Failed to load notices:', err);
      setSaveStatus({ type: 'error', message: err.message || 'Failed to load notices.' });
    } finally {
      setLoadingNotices(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'notices') {
      fetchAdminNotices();
    }
  }, [activeTab]);

  const handleCreateNotice = async (e) => {
    e.preventDefault();
    if (!noticeForm.title || !noticeForm.content) return;
    
    setIsSaving(true);
    setSaveStatus({ type: '', message: '' });
    
    try {
      if (!hasValidCredentials) {
        const newMockNotice = {
          id: String(Date.now()),
          title: noticeForm.title,
          content: noticeForm.content,
          category: noticeForm.category,
          society: noticeForm.society || null,
          link_url: noticeForm.link_url || null,
          created_at: new Date().toISOString()
        };
        setNoticesList(prev => [newMockNotice, ...prev]);
        setSaveStatus({ type: 'success', message: 'Notice created successfully (local mock)!' });
        setNoticeForm({ title: '', category: 'Event', society: '', content: '', link_url: '' });
        setIsSaving(false);
        return;
      }

      const { error } = await supabase
        .from('notices')
        .insert([{
          title: noticeForm.title,
          content: noticeForm.content,
          category: noticeForm.category,
          society: noticeForm.society || null,
          link_url: noticeForm.link_url || null,
        }]);

      if (error) throw error;
      
      setSaveStatus({ type: 'success', message: 'Notice published successfully onto the Campus Notice Board!' });
      setNoticeForm({ title: '', category: 'Event', society: '', content: '', link_url: '' });
      fetchAdminNotices();
    } catch (err) {
      if (err.message && err.message.includes('schema cache')) {
        setSaveStatus({
          type: 'error',
          message: "The 'notices' table does not exist in your Supabase database. Please run the SQL migration in your Supabase SQL Editor to create it."
        });
      } else {
        setSaveStatus({ type: 'error', message: err.message || 'Failed to publish notice.' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNotice = async (id) => {
    if (!window.confirm('Are you sure you want to delete this notice?')) return;
    setIsSaving(true);
    setSaveStatus({ type: '', message: '' });

    try {
      if (!hasValidCredentials) {
        setNoticesList(prev => prev.filter(n => n.id !== id));
        setSaveStatus({ type: 'success', message: 'Notice deleted successfully (local mock)!' });
        setIsSaving(false);
        return;
      }

      const { error } = await supabase
        .from('notices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSaveStatus({ type: 'success', message: 'Notice removed from board successfully.' });
      fetchAdminNotices();
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to delete notice.' });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Upload states
  const [file, setFile] = useState(null);
  const [parsingLogs, setParsingLogs] = useState([]);
  const [parsedData, setParsedData] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });

  // Manual Editor Filters
  const [selectedCourse, setSelectedCourse] = useState('BMS');
  const [selectedSem, setSelectedSem] = useState('2');
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [editingSlotIdx, setEditingSlotIdx] = useState(null);
  const [editFields, setEditFields] = useState({ subject: '', teacher: '', room: '' });

  // Helpers for Excel parser
  const clean = (s) => String(s || '').trim();

  function splitOutsideParentheses(str) {
    const parts = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      }
      
      if (char === '/' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim());
    return parts;
  }

  function parseUnifiedCell(cellValue, periodId, facultyMap, defaultRoom) {
    if (!cellValue) {
      return { period: periodId, subject: "Free", teacher: "-", room: "-" };
    }

    const parts = splitOutsideParentheses(cellValue);
    if (parts.length > 1) {
      const parsedParts = [];

      parts.forEach(part => {
        let partText = part.trim();
        let partRoom = defaultRoom;

        let groupLabel = "";
        const parenGroupMatch = partText.match(/\(((?:G1\s*\+\s*G2)|G1|G2)\)/i);
        if (parenGroupMatch) {
          groupLabel = parenGroupMatch[1].toUpperCase().replace(/\s+/g, '');
          partText = partText.replace(/\(((?:G1\s*\+\s*G2)|G1|G2)\)/i, '').trim();
        } else {
          const rawGroupMatch = partText.match(/\b((?:G1\s*\+\s*G2)|G1|G2)\b/i);
          if (rawGroupMatch) {
            groupLabel = rawGroupMatch[1].toUpperCase().replace(/\s+/g, '');
            partText = partText.replace(/\b((?:G1\s*\+\s*G2)|G1|G2)\b/i, '').trim();
          }
        }

        const partRoomMatch = partText.match(/\(([^)]+)\)/);
        if (partRoomMatch) {
          const roomVal = partRoomMatch[1];
          partRoom = roomVal.split('/').map(r => {
            let rClean = r.trim();
            return rClean.match(/^\d+/) ? `Room ${rClean}` : rClean;
          }).join(' / ');
          partText = partText.replace(/\([^)]+\)/, '').trim();
        } else {
          const endRoomMatch = partText.match(/\s+(\d{3})$/);
          if (endRoomMatch) {
            partRoom = `Room ${endRoomMatch[1]}`;
            partText = partText.replace(/\s+\d{3}$/, '').trim();
          }
        }

        const teacherCodeLower = partText.trim().toLowerCase();
        let subjectName = partText.trim();
        let teacherName = partText.trim();

        let found = facultyMap[teacherCodeLower];
        if (!found) {
          const keys = Object.keys(facultyMap);
          for (let k of keys) {
            if (teacherCodeLower.includes(k) || k.includes(teacherCodeLower)) {
              found = facultyMap[k];
              break;
            }
          }
        }

        if (found) {
          subjectName = found.paperName;
          teacherName = found.facultyName;
        } else {
          if (teacherCodeLower.includes('unsupervised') || teacherCodeLower.includes('unsuprvised')) {
            subjectName = "Free";
            teacherName = "-";
          } else if (teacherCodeLower.includes('free') || teacherCodeLower === 'ei' || teacherCodeLower === 'ee') {
            subjectName = "Unsupervised Class";
            teacherName = "-";
          }
        }

        parsedParts.push({
          group: groupLabel,
          subject: subjectName,
          teacher: teacherName,
          room: partRoom
        });
      });

      let subjectMerged = "";
      let teacherMerged = "";
      let roomMerged = "";

      const allSubjectsSame = parsedParts.every(p => p.subject === parsedParts[0].subject);
      const allRoomsSame = parsedParts.every(p => p.room === parsedParts[0].room);
      const hasAnyGroup = parsedParts.some(p => p.group);

      if (allSubjectsSame) {
        subjectMerged = parsedParts[0].subject;
        teacherMerged = parsedParts.map(p => {
          return hasAnyGroup ? `${p.teacher} (${p.group || 'G?'})` : p.teacher;
        }).join(' / ');
      } else {
        subjectMerged = parsedParts.map(p => {
          return hasAnyGroup ? `${p.group || 'G?'}: ${p.subject}` : p.subject;
        }).join(' | ');
        teacherMerged = parsedParts.map(p => {
          return hasAnyGroup ? `${p.teacher} (${p.group || 'G?'})` : p.teacher;
        }).join(' / ');
      }

      if (allRoomsSame) {
        roomMerged = parsedParts[0].room;
      } else {
        roomMerged = parsedParts.map(p => {
          return hasAnyGroup ? `${p.group || 'G?'}: ${p.room}` : p.room;
        }).join(' / ');
      }

      return {
        period: periodId,
        subject: subjectMerged,
        teacher: teacherMerged,
        room: roomMerged
      };
    } else {
      let text = cellValue.trim();
      let room = defaultRoom;

      let groupLabel = "";
      const parenGroupMatch = text.match(/\(((?:G1\s*\+\s*G2)|G1|G2)\)/i);
      if (parenGroupMatch) {
        groupLabel = parenGroupMatch[1].toUpperCase().replace(/\s+/g, '');
        text = text.replace(/\(((?:G1\s*\+\s*G2)|G1|G2)\)/i, '').trim();
      } else {
        const rawGroupMatch = text.match(/\b((?:G1\s*\+\s*G2)|G1|G2)\b/i);
        if (rawGroupMatch) {
          groupLabel = rawGroupMatch[1].toUpperCase().replace(/\s+/g, '');
          text = text.replace(/\b((?:G1\s*\+\s*G2)|G1|G2)\b/i, '').trim();
        }
      }

      const roomMatch = text.match(/\(([^)]+)\)/);
      if (roomMatch) {
        const roomVal = roomMatch[1];
        room = roomVal.split('/').map(r => {
          let rClean = r.trim();
          return rClean.match(/^\d+/) ? `Room ${rClean}` : rClean;
        }).join(' / ');
        text = text.replace(/\([^)]+\)/, '').trim();
      } else {
        const endRoomMatch = text.match(/\s+(\d{3})$/);
        if (endRoomMatch) {
          room = `Room ${endRoomMatch[1]}`;
          text = text.replace(/\s+\d{3}$/, '').trim();
        }
      }

      const teacherCodeLower = text.toLowerCase();
      let subjectName = text;
      let teacherName = text;

      let found = facultyMap[teacherCodeLower];
      if (!found) {
        const keys = Object.keys(facultyMap);
        for (let k of keys) {
          if (teacherCodeLower.includes(k) || k.includes(teacherCodeLower)) {
            found = facultyMap[k];
            break;
          }
        }
      }

      if (found) {
        subjectName = found.paperName;
        teacherName = found.facultyName;
      } else {
        if (teacherCodeLower.includes('unsupervised') || teacherCodeLower.includes('unsuprvised')) {
          subjectName = "Free";
          teacherName = "-";
        } else if (teacherCodeLower.includes('free') || teacherCodeLower === 'ei' || teacherCodeLower === 'ee') {
          subjectName = "Unsupervised Class";
          teacherName = "-";
        }
      }

      if (groupLabel) {
        subjectName = `${subjectName} (${groupLabel})`;
      }

      return {
        period: periodId,
        subject: subjectName,
        teacher: teacherName,
        room: room
      };
    }
  }

  // File Drag-Drop triggers
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectAndParseFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      selectAndParseFile(e.target.files[0]);
    }
  };

  const addLog = (msg, type = 'info') => {
    setParsingLogs(prev => [...prev, { text: msg, type, timestamp: new Date().toLocaleTimeString() }]);
  };

  // Main Parser adapted from parse_timetables.cjs
  const selectAndParseFile = (selectedFile) => {
    setFile(selectedFile);
    setParsingLogs([]);
    setParsedData(null);
    setSaveStatus({ type: '', message: '' });
    setIsParsing(true);
    addLog(`Selected file: ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)`, 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        addLog(`Successfully read binary Excel. Sheets present: ${workbook.SheetNames.join(', ')}`, 'success');

        const sheetsToParse = [
          { name: 'BBA(FIA) Sem2', defaultCourse: 'BBA FIA', defaultSem: '2' },
          { name: 'BMS Sem2', defaultCourse: 'BMS', defaultSem: '2' },
          { name: 'BBA(FIA) Sem4', defaultCourse: 'BBA FIA', defaultSem: '4' },
          { name: 'BMS Sem-4', defaultCourse: 'BMS', defaultSem: '4' },
          { name: 'BBA(FIA) Sem6', defaultCourse: 'BBA FIA', defaultSem: '6' },
          { name: 'BMS Sem6', defaultCourse: 'BMS', defaultSem: '6' },
          { name: 'BMS BBA Sem8', defaultCourse: 'BMS', defaultSem: '8' }
        ];

        const timetables = {};

        sheetsToParse.forEach(({ name, defaultCourse, defaultSem }) => {
          const sheet = workbook.Sheets[name];
          if (!sheet) {
            addLog(`⚠️ Sheet "${name}" not found. Skipping.`, 'warning');
            return;
          }

          const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          addLog(`Parsing sheet: "${name}" (${sheetData.length} rows found)`, 'info');

          // Find start indices of timetables
          const blockStarts = [];
          sheetData.forEach((row, idx) => {
            const rowStr = row.map(c => clean(c)).join(' ');
            if (rowStr.includes('SHAHEED SUKHDEV COLLEGE OF BUSINESS STUDIES') || rowStr.includes('SHAHEED SUKHDEV COLLEGE OF')) {
              blockStarts.push(idx);
            }
          });

          if (blockStarts.length === 0) {
            addLog(`❌ Could not find any timetable block markers in sheet "${name}".`, 'error');
            return;
          }

          addLog(`Found ${blockStarts.length} timetable block(s) in sheet "${name}".`, 'success');

          blockStarts.forEach((startRow, bIdx) => {
            let course = defaultCourse;
            let sem = defaultSem;
            let section = 'A';
            let defaultRoom = 'Room 703';

            // Look ahead 5 rows for metadata
            for (let i = 1; i < 5; i++) {
              const row = sheetData[startRow + i] || [];
              const rowStr = row.map(c => clean(c)).join(' ');
              
              if (rowStr.includes('BBA(FIA)') || rowStr.includes('BBA (FIA)')) {
                course = 'BBA FIA';
              } else if (rowStr.includes('BMS')) {
                course = 'BMS';
              }
              
              const semMatch = rowStr.match(/(\d+)(?:st|nd|rd|th)?\s*Sem/i) || rowStr.match(/Sem\s*[-]?\s*(\d+)/i) || rowStr.match(/(\d+)\s*Year/i);
              if (semMatch) {
                sem = semMatch[1];
              }
              
              const secMatch = rowStr.match(/Section\s*([A-D])/i) || rowStr.match(/Sec\s*([A-D])/i) || rowStr.match(/\b([A-D])\b/);
              if (secMatch) {
                section = secMatch[1];
              }

              const roomMatch = rowStr.match(/Room\s*No\.?\s*(\d{3})/i) || rowStr.match(/Room\s*No\.?\s*([A-Za-z0-9]+)/i);
              if (roomMatch) {
                defaultRoom = `Room ${roomMatch[1].trim()}`;
              }
            }

            addLog(`  -> Block ${bIdx}: Mapped to ${course} Sem ${sem} Section ${section} (Room: ${defaultRoom})`, 'info');

            // Find timings row
            let periodRowIdx = -1;
            let timingsRowIdx = -1;

            for (let i = 2; i < 8; i++) {
              const row = sheetData[startRow + i] || [];
              const rowStr = row.map(c => clean(c)).join(' ');
              if (rowStr.includes('Infinity Hour') || (rowStr.includes('I') && rowStr.includes('II') && rowStr.includes('III'))) {
                periodRowIdx = startRow + i;
                timingsRowIdx = periodRowIdx + 1;
                break;
              }
            }

            if (periodRowIdx === -1) {
              addLog(`  ❌ Could not find period header row for Block ${bIdx}`, 'error');
              return;
            }

            // Read classes for Monday to Friday
            const dayRows = {};
            for (let i = 1; i <= 8; i++) {
              const row = sheetData[timingsRowIdx + i] || [];
              const dayLabel = clean(row[0]);
              if (DAYS.includes(dayLabel)) {
                dayRows[dayLabel] = row;
              }
            }

            // Find paper mapping (typically starts within 8-32 rows after timingsRowIdx)
            const facultyMap = {};
            for (let r = timingsRowIdx + 7; r < timingsRowIdx + 32; r++) {
              const row = sheetData[r] || [];
              const rowStr = row.map(c => clean(c)).join(' ');

              if (rowStr.includes('SHAHEED SUKHDEV COLLEGE OF BUSINESS STUDIES') || rowStr.includes('SHAHEED SUKHDEV COLLEGE OF')) {
                break;
              }

              const nonEmpties = row.map(c => clean(c)).filter(Boolean);
              if (nonEmpties.length >= 3) {
                const paperName = clean(row[1]);
                let facultyName = '';
                let facultyCode = '';

                for (let c = 2; c < row.length; c++) {
                  const val = clean(row[c]);
                  if (val.startsWith('Dr.') || val.startsWith('Mr.') || val.startsWith('Ms.') || val.startsWith('Prof.')) {
                    facultyName = val;
                    for (let c2 = c + 1; c2 < row.length; c2++) {
                      const codeVal = clean(row[c2]);
                      if (codeVal && !codeVal.includes('Th') && !codeVal.includes('Prac') && !codeVal.includes('Tute')) {
                        facultyCode = codeVal;
                        break;
                      }
                    }
                    break;
                  }
                }

                if (facultyCode && paperName) {
                  facultyMap[facultyCode.toLowerCase()] = { facultyName, paperName };
                }
              }
            }

            // Generate daily schedules
            const weekSchedule = {};
            DAYS.forEach(day => {
              const fullDayName = FULL_DAYS[day];
              const row = dayRows[day] || [];
              const dayClasses = [];

              const periodColumns = [
                { id: 1, col: 1 },
                { id: 2, col: 2 },
                { id: 3, col: 3 },
                { id: 0, col: 4, isBreak: true },
                { id: 4, col: 5 },
                { id: 5, col: 6 },
                { id: 6, col: 7 },
                { id: 7, col: 8 }
              ];

              periodColumns.forEach(({ id, col, isBreak }) => {
                if (isBreak) {
                  dayClasses.push({ period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" });
                  return;
                }

                const cellValue = clean(row[col]);
                const parsedCell = parseUnifiedCell(cellValue, id, facultyMap, defaultRoom);
                dayClasses.push(parsedCell);
              });

              weekSchedule[fullDayName] = dayClasses;
            });

            if (!timetables[course]) timetables[course] = {};
            if (!timetables[course][sem]) timetables[course][sem] = {};
            timetables[course][sem][section] = weekSchedule;
          });
        });

        // Add BSc Computer Science fallback generator
        addLog("Injecting BSc Computer Science fallback schedules...", "info");
        timetables["Bsc Comp Sci"] = {};
        ["2", "4", "6", "8"].forEach(sem => {
          timetables["Bsc Comp Sci"][sem] = {};
          const weekSchedule = {};
          const subjects = csSubjects[sem];
          
          ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].forEach((day, dIdx) => {
            const dayClasses = [];
            const seed = parseInt(sem) + dIdx;
            
            const periodColumns = [
              { id: 1 }, { id: 2 }, { id: 3 }, { id: 0, isBreak: true }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }
            ];

            periodColumns.forEach(({ id, isBreak }) => {
              if (isBreak) {
                dayClasses.push({ period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" });
                return;
              }

              const classSeed = seed + id;
              const isFree = (classSeed % 6 === 0) && (id > 5 || id === 1);
              
              if (isFree) {
                dayClasses.push({ period: id, subject: "Free", teacher: "-", room: "-" });
              } else {
                const subIndex = classSeed % subjects.length;
                const teachIndex = (classSeed + 2) % csTeachers.length;
                const roomIndex = (classSeed + 4) % csRooms.length;
                
                dayClasses.push({
                  period: id,
                  subject: subjects[subIndex].name,
                  teacher: csTeachers[teachIndex],
                  room: csRooms[roomIndex]
                });
              }
            });

            weekSchedule[day] = dayClasses;
          });

          timetables["Bsc Comp Sci"][sem]["A"] = weekSchedule;
        });

        addLog("BSc Computer Science mock schedule injected successfully.", "success");
        setParsedData(timetables);
        addLog("All parsing checks passed! Timetable is ready to be published.", "success");
      } catch (err) {
        addLog(`Parsing Exception: ${err.message}`, 'error');
        console.error(err);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  // Push to Supabase config
  const handlePublishTimetable = async () => {
    if (!parsedData) return;
    setIsSaving(true);
    setSaveStatus({ type: '', message: '' });
    addLog("Saving new timetable data to Supabase configurations...", "info");

    try {
      await updateTimetable(parsedData);
      setSaveStatus({ type: 'success', message: 'Timetable published successfully! All student dashboards have been updated.' });
      addLog("Successfully published timetable to database!", "success");
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to save timetable to Supabase.' });
      addLog(`Failed to save to database: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Manual editor handlers
  const getCourses = () => Object.keys(timetable || {});
  const getSemesters = () => {
    if (!timetable || !timetable[selectedCourse]) return [];
    return Object.keys(timetable[selectedCourse]);
  };
  const getSections = () => {
    if (!timetable || !timetable[selectedCourse] || !timetable[selectedCourse][selectedSem]) return [];
    return Object.keys(timetable[selectedCourse][selectedSem]);
  };

  const getActiveDayClasses = () => {
    if (!timetable || !timetable[selectedCourse] || !timetable[selectedCourse][selectedSem] || !timetable[selectedCourse][selectedSem][selectedSection]) {
      return [];
    }
    return timetable[selectedCourse][selectedSem][selectedSection][selectedDay] || [];
  };

  const handleEditClick = (idx, slot) => {
    setEditingSlotIdx(idx);
    setEditFields({
      subject: slot.subject,
      teacher: slot.teacher,
      room: slot.room
    });
  };

  const handleManualSave = async () => {
    try {
      setIsSaving(true);
      setSaveStatus({ type: '', message: '' });
      
      // Clone master timetable
      const updatedTimetable = JSON.parse(JSON.stringify(timetable));
      
      // Update cell values
      const dayClasses = updatedTimetable[selectedCourse][selectedSem][selectedSection][selectedDay];
      dayClasses[editingSlotIdx] = {
        ...dayClasses[editingSlotIdx],
        subject: editFields.subject,
        teacher: editFields.teacher,
        room: editFields.room
      };

      await updateTimetable(updatedTimetable);
      setEditingSlotIdx(null);
      setSaveStatus({ type: 'success', message: 'Class slot updated successfully in database!' });
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to update slot.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="admin-console-container">
      {/* Header */}
      <header className="admin-console-header">
        <div className="header-left-admin">
          <button className="btn-back-admin" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to OS
          </button>
          <h2>Admin Console Workspace</h2>
        </div>
        <div className="admin-tag-container">
          <span className="admin-badge-indicator">System Admin</span>
          <span className="admin-email">aditya.25015@sscbs.du.ac.in</span>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="admin-console-content">
        
        {/* Navigation Tabs */}
        <nav className="admin-tabs">
          <button 
            className={`admin-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Upload Schedule Excel
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            Live Schedule Editor
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'notices' ? 'active' : ''}`}
            onClick={() => setActiveTab('notices')}
          >
            Campus Notice Board Manager
          </button>
        </nav>

        {saveStatus.message && (
          <div className={`admin-status-banner ${saveStatus.type}`}>
            {saveStatus.type === 'success' ? '✓ ' : '⚠️ '}
            {saveStatus.message}
          </div>
        )}

        {/* Tab contents */}
        {activeTab === 'upload' ? (
          <div className="tab-pane upload-pane">
            <div className="pane-left">
              <h3>Upload Master Timetable</h3>
              <p className="subtitle-admin">Upload the official SSCBS Student Timetable Excel file (`.xlsx`) to parse schedules for BMS and BBA FIA. Computer Science schedules are automatically updated with fallback configurations.</p>

              {/* Drag/Drop Box */}
              <div 
                className={`dropzone ${file ? 'has-file' : ''}`}
                onDragOver={handleDragOver}
                onDrop={handleFileDrop}
              >
                <div className="dropzone-icon">📁</div>
                {file ? (
                  <div className="file-info-box">
                    <span className="file-name-label">{file.name}</span>
                    <span className="file-size-label">{Math.round(file.size / 1024)} KB</span>
                  </div>
                ) : (
                  <p className="dropzone-text">Drag & drop timetable Excel file here or <label className="file-input-label">browse<input type="file" onChange={handleFileSelect} accept=".xlsx" className="hidden-file-input" /></label></p>
                )}
              </div>

              {parsedData && (
                <div className="publish-actions">
                  <button 
                    className="btn-publish-timetable" 
                    onClick={handlePublishTimetable}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Publishing to OS...' : 'Save & Publish Dynamic Timetable'}
                  </button>
                  <button className="btn-discard" onClick={() => { setFile(null); setParsedData(null); setParsingLogs([]); }} disabled={isSaving}>Discard</button>
                </div>
              )}
            </div>

            <div className="pane-right">
              <h3>Parsing Operations Console</h3>
              <div className="console-logs-window">
                {parsingLogs.length === 0 ? (
                  <div className="no-logs">Console idle. Await spreadsheet file upload...</div>
                ) : (
                  parsingLogs.map((log, idx) => (
                    <div key={idx} className={`log-line ${log.type}`}>
                      <span className="log-time">[{log.timestamp}]</span>
                      <span className="log-text">{log.text}</span>
                    </div>
                  ))
                )}
                {isParsing && <div className="log-line info loader-log">Parsing spreadsheet rows... <span className="console-spinner"></span></div>}
              </div>
            </div>
          </div>
        ) : activeTab === 'editor' ? (
          <div className="tab-pane editor-pane">
            <div className="editor-controls-row">
              <div className="control-item">
                <label>Course</label>
                <select value={selectedCourse} onChange={(e) => { setSelectedCourse(e.target.value); setEditingSlotIdx(null); }} className="admin-select">
                  {getCourses().map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="control-item">
                <label>Semester</label>
                <select value={selectedSem} onChange={(e) => { setSelectedSem(e.target.value); setEditingSlotIdx(null); }} className="admin-select">
                  {getSemesters().map(s => <option key={s} value={s}>Sem {s}</option>)}
                </select>
              </div>
              <div className="control-item">
                <label>Section</label>
                <select value={selectedSection} onChange={(e) => { setSelectedSection(e.target.value); setEditingSlotIdx(null); }} className="admin-select">
                  {getSections().map(s => <option key={s} value={s}>Section {s}</option>)}
                </select>
              </div>
              <div className="control-item">
                <label>Day of Week</label>
                <select value={selectedDay} onChange={(e) => { setSelectedDay(e.target.value); setEditingSlotIdx(null); }} className="admin-select">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {/* Timetable Slots Table */}
            <div className="schedule-table-container">
              <table className="admin-schedule-table">
                <thead>
                  <tr>
                    <th>Period / Time</th>
                    <th>Subject Title</th>
                    <th>Professor Name</th>
                    <th>Classroom</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {getActiveDayClasses().map((slot, idx) => {
                    const isEditing = editingSlotIdx === idx;
                    return (
                      <tr key={idx} className={slot.isBreak ? 'break-row-admin' : ''}>
                        <td className="period-col-admin">
                          <strong>{slot.isBreak ? 'Infinity Hour' : `Period ${slot.period}`}</strong>
                        </td>
                        <td>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editFields.subject} 
                              onChange={(e) => setEditFields(prev => ({ ...prev, subject: e.target.value }))}
                              className="admin-edit-input"
                            />
                          ) : (
                            <span>{slot.subject}</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editFields.teacher} 
                              onChange={(e) => setEditFields(prev => ({ ...prev, teacher: e.target.value }))}
                              className="admin-edit-input"
                              disabled={slot.isBreak}
                            />
                          ) : (
                            <span>{slot.teacher}</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editFields.room} 
                              onChange={(e) => setEditFields(prev => ({ ...prev, room: e.target.value }))}
                              className="admin-edit-input"
                              disabled={slot.isBreak}
                            />
                          ) : (
                            <span>{slot.room}</span>
                          )}
                        </td>
                        <td className="action-col-admin">
                          {isEditing ? (
                            <div className="edit-btn-row">
                              <button className="btn-action-save" onClick={handleManualSave} disabled={isSaving}>Save</button>
                              <button className="btn-action-cancel" onClick={() => setEditingSlotIdx(null)} disabled={isSaving}>Cancel</button>
                            </div>
                          ) : (
                            <button className="btn-action-edit" onClick={() => handleEditClick(idx, slot)}>Edit</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="tab-pane notices-pane">
            <div className="pane-left notice-creator-card">
              <h3>Publish New Notice</h3>
              <p className="subtitle-admin">Create announcements for events, society updates, guest lectures, and other college activities.</p>
              
              <form onSubmit={handleCreateNotice} className="admin-notice-form">
                <div className="form-item-admin">
                  <label htmlFor="notice-title">Notice Title</label>
                  <input
                    type="text"
                    id="notice-title"
                    placeholder="e.g. HackSSCBS 2026 Registration Open"
                    value={noticeForm.title}
                    onChange={(e) => setNoticeForm(prev => ({ ...prev, title: e.target.value }))}
                    required
                    className="admin-input-field"
                  />
                </div>
                
                <div className="form-row-admin">
                  <div className="form-item-admin flex-1">
                    <label htmlFor="notice-category">Category</label>
                    <select
                      id="notice-category"
                      value={noticeForm.category}
                      onChange={(e) => setNoticeForm(prev => ({ ...prev, category: e.target.value }))}
                      className="admin-select"
                    >
                      <option value="Event">Event</option>
                      <option value="Session">Session</option>
                      <option value="Society">Society</option>
                      <option value="Academic">Academic</option>
                    </select>
                  </div>
                  
                  <div className="form-item-admin flex-1">
                    <label htmlFor="notice-society">Organising Society</label>
                    <input
                      type="text"
                      id="notice-society"
                      placeholder="e.g. Kronos (Optional)"
                      value={noticeForm.society}
                      onChange={(e) => setNoticeForm(prev => ({ ...prev, society: e.target.value }))}
                      className="admin-input-field"
                    />
                  </div>
                </div>

                <div className="form-item-admin">
                  <label htmlFor="notice-content">Notice Description</label>
                  <textarea
                    id="notice-content"
                    rows="4"
                    placeholder="Describe the notice or event details in full..."
                    value={noticeForm.content}
                    onChange={(e) => setNoticeForm(prev => ({ ...prev, content: e.target.value }))}
                    required
                    className="admin-textarea-field"
                  />
                </div>

                <div className="form-item-admin">
                  <label htmlFor="notice-link">Registration / Info Link (Optional)</label>
                  <input
                    type="url"
                    id="notice-link"
                    placeholder="e.g. https://forms.gle/... or website link"
                    value={noticeForm.link_url}
                    onChange={(e) => setNoticeForm(prev => ({ ...prev, link_url: e.target.value }))}
                    className="admin-input-field"
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn-publish-timetable" 
                  disabled={isSaving}
                  style={{ marginTop: '0.5rem' }}
                >
                  {isSaving ? 'Publishing Notice...' : 'Publish Campus Notice'}
                </button>
              </form>
            </div>

            <div className="pane-right notices-list-card">
              <h3>Active Notices Board ({noticesList.length})</h3>
              
              <div className="notices-manager-list">
                {loadingNotices ? (
                  <div className="notices-manager-loading">
                    <span className="console-spinner"></span>
                    <p>Loading notices...</p>
                  </div>
                ) : noticesList.length === 0 ? (
                  <div className="no-logs">No active notices found. Publish one to get started!</div>
                ) : (
                  <div className="admin-notices-grid">
                    {noticesList.map((notice) => (
                      <div key={notice.id} className="admin-notice-item">
                        <div className="notice-item-meta">
                          <span className={`category-tag tag-${notice.category.toLowerCase()}`}>{notice.category}</span>
                          {notice.society && <span className="notice-item-society">@{notice.society}</span>}
                        </div>
                        <h4 className="notice-item-title">{notice.title}</h4>
                        <p className="notice-item-desc">{notice.content.substring(0, 80)}{notice.content.length > 80 ? '...' : ''}</p>
                        <div className="notice-item-actions">
                          <span className="notice-item-date">{new Date(notice.created_at).toLocaleDateString()}</span>
                          <button 
                            className="btn-delete-notice"
                            onClick={() => handleDeleteNotice(notice.id)}
                            disabled={isSaving}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
