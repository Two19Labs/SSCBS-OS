import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useTimetable } from '../context/TimetableContext';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { isAdminEmail } from '../lib/admin';
import { subscribeToPresence, fetchAnalyticsData, FEATURE_NAMES } from '../lib/analytics';
import DateTimePicker from './DateTimePicker';
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
  1: [
    { name: "Programming Fundamentals using C++", code: "Core" },
    { name: "Computer System Architecture", code: "Core" },
    { name: "GE - Mathematics I", code: "GE" },
    { name: "AEC - Environmental Science", code: "AEC" },
    { name: "SEC - Basic IT Tools", code: "SEC" },
    { name: "VAC - Digital Empowerment", code: "VAC" }
  ],
  2: [
    { name: "Data Structures", code: "Core" },
    { name: "Discrete Mathematical Structures", code: "Core" },
    { name: "Computer System Architecture", code: "Core" },
    { name: "GE - Numerical Methods", code: "GE" },
    { name: "SEC - Web Design and Development", code: "SEC" },
    { name: "VAC - Digital Empowerment", code: "VAC" }
  ],
  3: [
    { name: "Data Structures", code: "Core" },
    { name: "Operating Systems", code: "Core" },
    { name: "Discrete Mathematical Structures", code: "Core" },
    { name: "GE - Data Analysis", code: "GE" },
    { name: "SEC - Web Designing", code: "SEC" },
    { name: "VAC - Ethics and Values", code: "VAC" }
  ],
  4: [
    { name: "Design & Analysis of Algorithms", code: "Core" },
    { name: "Database Management Systems", code: "Core" },
    { name: "Computer Networks", code: "Core" },
    { name: "DSE - Artificial Intelligence", code: "DSE" },
    { name: "SEC - Programming with Python", code: "SEC" },
    { name: "VAC - Cyber Security", code: "VAC" }
  ],
  5: [
    { name: "Design & Analysis of Algorithms", code: "Core" },
    { name: "Software Engineering", code: "Core" },
    { name: "DSE - Artificial Intelligence", code: "DSE" },
    { name: "DSE - Web Technology", code: "DSE" },
    { name: "GE - Computer Graphics", code: "GE" }
  ],
  6: [
    { name: "Software Engineering", code: "Core" },
    { name: "Operating Systems", code: "Core" },
    { name: "Theory of Computation", code: "Core" },
    { name: "DSE - Machine Learning", code: "DSE" },
    { name: "GE - Data Science using R", code: "GE" }
  ],
  7: [
    { name: "Theory of Computation", code: "Core" },
    { name: "Machine Learning", code: "Core" },
    { name: "DSE - Cloud Computing", code: "DSE" },
    { name: "DSE - Data Science", code: "DSE" }
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
  const { user } = useAuth();
  const { timetable, updateTimetable } = useTimetable();
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'editor', 'notices', 'analytics'

  const isAdmin = isAdminEmail(user?.email);

  if (!isAdmin) {
    return (
      <div className="admin-access-denied-wrapper">
        <div className="admin-access-denied-card">
          <span className="access-denied-icon">🔒</span>
          <h2>Access Denied</h2>
          <p>You do not have administrative privileges to access the SSCBS OS Admin Console.</p>
          <p className="access-denied-sub">Only authorized administrator accounts can manage campus timetables, notices, and analytics.</p>
          <button className="btn-access-denied-back" onClick={onBack}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }


  
  // Notices manager states
  const [noticesList, setNoticesList] = useState([]);
  const [loadingNotices, setLoadingNotices] = useState(false);
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    category: 'Event',
    society: '',
    content: '',
    link_url: '',
    event_date: '',
    active_from: '',
    active_to: ''
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

      // Housekeeping: delete expired notices from the database
      try {
        await supabase
          .from('notices')
          .delete()
          .lt('active_to', new Date().toISOString());
      } catch (err) {
        console.warn('Housekeeping failed:', err);
      }

      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching admin notices:', error);
        if (error.message && (error.message.includes('schema cache') || error.message.includes('does not exist') || error.code === '42P01')) {
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
      if (err.message && err.message.includes('Failed to fetch')) {
        setSaveStatus({
          type: 'error',
          message: 'Connection Failed (Failed to fetch): Please disable any ad blockers, privacy extensions, or Brave Shields blocking supabase.co and try again.'
        });
      } else {
        setSaveStatus({ type: 'error', message: err.message || 'Failed to load notices.' });
      }
    } finally {
      setLoadingNotices(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'notices') {
      fetchAdminNotices();
    } else if (activeTab === 'analytics') {
      fetchDemographicsData();
    }
  }, [activeTab]);

  const handleCreateNotice = async (e) => {
    e.preventDefault();
    if (!noticeForm.title || !noticeForm.content) return;

    const activeFromVal = noticeForm.active_from ? new Date(noticeForm.active_from).toISOString() : null;
    const activeToVal = noticeForm.active_to ? new Date(noticeForm.active_to).toISOString() : null;
    const eventDateVal = noticeForm.event_date ? new Date(noticeForm.event_date).toISOString() : null;

    if (activeFromVal && activeToVal && new Date(activeFromVal) >= new Date(activeToVal)) {
      setSaveStatus({ type: 'error', message: 'The expiry date ("Hide After") must be later than the display start date ("Show From").' });
      return;
    }

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
          event_date: eventDateVal,
          active_from: activeFromVal,
          active_to: activeToVal,
          created_at: new Date().toISOString()
        };
        setNoticesList(prev => [newMockNotice, ...prev]);
        setSaveStatus({ type: 'success', message: 'Notice created successfully (local mock)!' });
        setNoticeForm({ title: '', category: 'Event', society: '', content: '', link_url: '', event_date: '', active_from: '', active_to: '' });
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
          event_date: eventDateVal,
          active_from: activeFromVal,
          active_to: activeToVal
        }]);

      if (error) throw error;
      
      setSaveStatus({ type: 'success', message: 'Notice published successfully onto the Campus Notice Board!' });
      setNoticeForm({ title: '', category: 'Event', society: '', content: '', link_url: '', event_date: '', active_from: '', active_to: '' });
      fetchAdminNotices();
    } catch (err) {
      if (err.message && (err.message.includes('schema cache') || err.message.includes('does not exist') || err.code === '42P01')) {
        setSaveStatus({
          type: 'error',
          message: "The 'notices' table does not exist in your Supabase database. Please run the SQL migration in your Supabase SQL Editor to create it."
        });
      } else if (err.message && err.message.includes('Failed to fetch')) {
        setSaveStatus({
          type: 'error',
          message: 'Connection Failed (Failed to fetch): Please disable any ad blockers, privacy extensions, or Brave Shields blocking supabase.co and try again.'
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
      if (err.message && err.message.includes('Failed to fetch')) {
        setSaveStatus({
          type: 'error',
          message: 'Connection Failed (Failed to fetch): Please disable any ad blockers, privacy extensions, or Brave Shields blocking supabase.co and try again.'
        });
      } else {
        setSaveStatus({ type: 'error', message: err.message || 'Failed to delete notice.' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Analytics & Real-time Presence states
  const [analyticsUsers, setAnalyticsUsers] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourse, setFilterCourse] = useState('All');
  const [filterSem, setFilterSem] = useState('All');

  // Real-Time Online Presence & Time-Series Graph States
  const [onlinePresence, setOnlinePresence] = useState([]);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState(7); // 7, 30, 90
  const [analyticsSummary, setAnalyticsSummary] = useState({
    dateLabels: [],
    series: { total: [], home: [], timetable: [], 'find-prof': [], waiver: [], gpa: [], buzz: [] },
    totals: { home: 0, timetable: 0, 'find-prof': 0, waiver: 0, gpa: 0, buzz: 0, grandTotal: 0 },
    topFeatureName: 'Timetable',
    topFeatureCount: 0
  });
  const [enabledSeries, setEnabledSeries] = useState({
    total: true,
    home: true,
    timetable: true,
    'find-prof': true,
    waiver: true,
    gpa: true,
    buzz: true
  });
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [tickerNow, setTickerNow] = useState(Date.now());

  // ⏱️ 1-second ticker for real-time live ping rendering
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 🟢 Real-Time Presence Subscription across all active connected students
  useEffect(() => {
    const unsubscribe = subscribeToPresence(user, 'admin', (presenceList) => {
      if (Array.isArray(presenceList)) {
        setOnlinePresence(presenceList);
      }
    });

    // Also fetch DB presence table directly & subscribe to Postgres Realtime
    if (hasValidCredentials) {
      const fetchDbPresence = async () => {
        try {
          const cutoff = new Date(Date.now() - 30000).toISOString();
          const { data } = await supabase
            .from('active_presence')
            .select('*')
            .gte('last_ping', cutoff);

          if (Array.isArray(data) && data.length > 0) {
            const dbList = data.map(item => ({
              id: item.user_id || item.session_id,
              name: item.name,
              email: item.email,
              course: item.course,
              semester: item.semester,
              section: item.section,
              currentView: item.current_view,
              viewLabel: item.view_label || FEATURE_NAMES[item.current_view] || 'Home Dashboard',
              device: item.device,
              lastPing: new Date(item.last_ping).getTime()
            }));

            setOnlinePresence(prev => {
              const map = {};
              (prev || []).forEach(p => { if (p && p.email) map[p.email] = p; });
              dbList.forEach(p => {
                if (p && p.email) {
                  if (!map[p.email] || (p.lastPing > (map[p.email].lastPing || 0))) {
                    map[p.email] = p;
                  }
                }
              });
              return Object.values(map);
            });
          }
        } catch (e) {}
      };

      fetchDbPresence();

      let dbChannel = null;
      try {
        dbChannel = supabase
          .channel('db-active-presence-changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'active_presence' }, () => {
            fetchDbPresence();
          })
          .subscribe();
      } catch (e) {}

      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
        try {
          if (dbChannel) supabase.removeChannel(dbChannel).catch(() => {});
        } catch (e) {}
      };
    }

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user]);

  // 📈 Fetch REAL Analytics event series from Supabase
  useEffect(() => {
    fetchAnalyticsData(analyticsTimeRange).then(summary => {
      if (summary) setAnalyticsSummary(summary);
    });
  }, [analyticsTimeRange]);

  const toggleSeries = (seriesKey) => {
    setEnabledSeries(prev => ({ ...prev, [seriesKey]: !prev[seriesKey] }));
  };

  const fetchDemographicsData = async () => {
    setLoadingAnalytics(true);
    setSaveStatus({ type: '', message: '' });

    if (!hasValidCredentials) {
      // Mock demographic data for sandbox mode
      const mockUsers = [
        { id: 'm1', name: 'Aditya Singhani', email: 'aditya.25015@sscbs.du.ac.in', course: 'BMS', semester: '2', section: 'A', lastActive: 'Online' },
        { id: 'm2', name: 'Manthan Kabra', email: 'manthan.25042@sscbs.du.ac.in', course: 'BMS', semester: '2', section: 'B', lastActive: '5 mins ago' },
        { id: 'm3', name: 'Kunal Sharma', email: 'kunal.25055@sscbs.du.ac.in', course: 'BBA FIA', semester: '2', section: 'A', lastActive: '2 hours ago' },
        { id: 'm4', name: 'Riya Gupta', email: 'riya.25078@sscbs.du.ac.in', course: 'BBA FIA', semester: '4', section: 'B', lastActive: 'Online' },
        { id: 'm5', name: 'Arjun Verma', email: 'arjun.25091@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '6', section: 'A', lastActive: '1 day ago' },
        { id: 'm6', name: 'Divya Sen', email: 'divya.25102@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '4', section: 'A', lastActive: '3 mins ago' },
        { id: 'm7', name: 'Siddharth Jain', email: 'sid.25114@sscbs.du.ac.in', course: 'BMS', semester: '6', section: 'A', lastActive: 'Offline' },
        { id: 'm8', name: 'Pooja Rawat', email: 'pooja.25123@sscbs.du.ac.in', course: 'BBA FIA', semester: '6', section: 'B', lastActive: 'Online' },
        { id: 'm9', name: 'Ishaan Malhotra', email: 'ishaan.25145@sscbs.du.ac.in', course: 'BMS', semester: '4', section: 'D', lastActive: '12 mins ago' },
        { id: 'm10', name: 'Ananya Roy', email: 'ananya.25156@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '2', section: 'A', lastActive: 'Offline' },
        { id: 'm11', name: 'Kabir Dev', email: 'kabir.25178@sscbs.du.ac.in', course: 'BMS', semester: '8', section: 'A', lastActive: 'Online' },
        { id: 'm12', name: 'Mehak Preet', email: 'mehak.25189@sscbs.du.ac.in', course: 'BMS', semester: '8', section: 'C', lastActive: '3 days ago' },
        { id: 'm13', name: 'Neil Dsouza', email: 'neil.25199@sscbs.du.ac.in', course: 'BBA FIA', semester: '2', section: 'A', lastActive: 'Offline' },
        { id: 'm14', name: 'Pranav Shah', email: 'pranav.25201@sscbs.du.ac.in', course: 'BMS', semester: '4', section: 'A', lastActive: '1 hour ago' },
        { id: 'm15', name: 'Sanya Mirza', email: 'sanya.25220@sscbs.du.ac.in', course: 'BBA FIA', semester: '8', section: 'B', lastActive: 'Online' },
        { id: 'm16', name: 'Tushar Mehta', email: 'tushar.25244@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '8', section: 'A', lastActive: '5 mins ago' },
        { id: 'm17', name: 'Vanshika Goel', email: 'vansh.25255@sscbs.du.ac.in', course: 'BMS', semester: '6', section: 'C', lastActive: 'Offline' },
        { id: 'm18', name: 'Yash Vardhan', email: 'yash.25266@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '6', section: 'A', lastActive: '4 hours ago' },
        { id: 'm19', name: 'Zara Khan', email: 'zara.25277@sscbs.du.ac.in', course: 'BBA FIA', semester: '4', section: 'A', lastActive: 'Online' },
        { id: 'm20', name: 'Rohan Mehra', email: 'rohan.25288@sscbs.du.ac.in', course: 'BMS', semester: '2', section: 'C', lastActive: 'Online' }
      ];
      setAnalyticsUsers(mockUsers);
      setLoadingAnalytics(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('user_id, settings, updated_at')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching demographics:', error);
        setSaveStatus({ type: 'error', message: error.message || 'Failed to load student demographics.' });
      } else {
        const formatted = (data || []).map(row => {
          const profile = row.settings || {};
          const now = new Date();
          const updated = new Date(row.updated_at);
          const diffMs = now - updated;
          let lastActive = 'Offline';

          if (diffMs < 60000 * 5) {
            lastActive = 'Online';
          } else if (diffMs < 60000 * 60) {
            lastActive = `${Math.floor(diffMs / 60000)} mins ago`;
          } else if (diffMs < 60000 * 60 * 24) {
            lastActive = `${Math.floor(diffMs / (60000 * 60))} hours ago`;
          } else {
            lastActive = `${Math.floor(diffMs / (60000 * 60 * 24))} days ago`;
          }

          return {
            id: row.user_id,
            name: profile.full_name || 'Anonymous Student',
            email: profile.email || 'No Email Sync',
            course: profile.course || 'Unset',
            semester: profile.semester ? String(profile.semester) : 'Unset',
            section: profile.section || 'Unset',
            lastActive
          };
        });
        setAnalyticsUsers(formatted);
      }
    } catch (err) {
      console.error('Failed to load user demographics:', err);
      setSaveStatus({ type: 'error', message: err.message || 'Failed to load user demographics.' });
    } finally {
      setLoadingAnalytics(false);
    }
  };
  
  // Dual Upload states
  const [mgmtFile, setMgmtFile] = useState(null);
  const [csFile, setCsFile] = useState(null);
  const [mgmtParsedData, setMgmtParsedData] = useState(null);
  const [csParsedData, setCsParsedData] = useState(null);
  const [parsingLogs, setParsingLogs] = useState([]);
  const [isParsingMgmt, setIsParsingMgmt] = useState(false);
  const [isParsingCs, setIsParsingCs] = useState(false);
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

  function parseSinglePart(text, defaultRoom, facultyMap) {
    let partText = text.trim();
    let partRoom = defaultRoom;
    let groupLabel = '';

    const parenGroupMatch = partText.match(/\(((?:G1\s*\+\s*G2)|G1|G2)\)/i) || partText.match(/\b((?:G1\s*\+\s*G2)|G1|G2)\b/i);
    if (parenGroupMatch) {
      groupLabel = parenGroupMatch[1].toUpperCase().replace(/\s+/g, '');
      partText = partText.replace(parenGroupMatch[0], '').trim();
    }

    const roomMatch = partText.match(/\(([^)]+)\)/);
    if (roomMatch) {
      const roomVal = roomMatch[1];
      partRoom = roomVal.split('/').map(r => r.trim().match(/^\d+/) ? 'Room ' + r.trim() : r.trim()).join(' / ');
      partText = partText.replace(/\([^)]+\)/, '').trim();
    } else {
      const endRoomMatch = partText.match(/\b(?:L|R|Room)?\s*(\d{3})\b/i);
      if (endRoomMatch) {
        partRoom = 'Room ' + endRoomMatch[1];
        partText = partText.replace(endRoomMatch[0], '').trim();
      }
    }

    let teacherCodeLower = partText.trim().toLowerCase();
    let subjectName = partText.trim();
    let teacherName = partText.trim();

    const codeParenMatch = partText.match(/^([A-Za-z0-9\s]+)\s*\(([^)]+)\)$/);
    if (codeParenMatch) {
      const c1 = codeParenMatch[1].trim().toLowerCase();
      const c2 = codeParenMatch[2].trim().toLowerCase();
      if (facultyMap[c1]) {
        teacherName = facultyMap[c1].facultyName;
        subjectName = facultyMap[c2] ? facultyMap[c2].paperName : (facultyMap[c1].paperName || codeParenMatch[2]);
      } else if (facultyMap[c2]) {
        teacherName = facultyMap[c2].facultyName;
        subjectName = facultyMap[c2].paperName;
      }
    } else if (facultyMap[teacherCodeLower]) {
      subjectName = facultyMap[teacherCodeLower].paperName;
      teacherName = facultyMap[teacherCodeLower].facultyName;
    } else {
      const keys = Object.keys(facultyMap);
      for (let k of keys) {
        if (teacherCodeLower && (teacherCodeLower.includes(k) || k.includes(teacherCodeLower))) {
          subjectName = facultyMap[k].paperName;
          teacherName = facultyMap[k].facultyName;
          break;
        }
      }
    }

    if (teacherCodeLower.includes('unsupervised')) { subjectName = 'Free'; teacherName = '-'; }
    else if (teacherCodeLower === 'free' || teacherCodeLower === 'ei' || teacherCodeLower === 'ee') { subjectName = 'Unsupervised Class'; teacherName = '-'; }

    return { group: groupLabel, subject: subjectName || partText, teacher: teacherName || partText, room: partRoom };
  }

  function parseUnifiedCell(cellValue, periodId, facultyMap, defaultRoom) {
    if (!cellValue) return { period: periodId, subject: 'Free', teacher: '-', room: '-' };
    const raw = clean(cellValue);
    if (!raw) return { period: periodId, subject: 'Free', teacher: '-', room: '-' };

    const parts = splitOutsideParentheses(raw);
    if (parts.length > 1) {
      const parsedParts = parts.map(part => parseSinglePart(part, defaultRoom, facultyMap));
      const allSubjectsSame = parsedParts.every(p => p.subject === parsedParts[0].subject);
      const allRoomsSame = parsedParts.every(p => p.room === parsedParts[0].room);
      const hasGroup = parsedParts.some(p => p.group);

      let subjectMerged = allSubjectsSame ? parsedParts[0].subject : parsedParts.map(p => hasGroup ? `${p.group || 'G?'}: ${p.subject}` : p.subject).join(' | ');
      let teacherMerged = parsedParts.map(p => hasGroup ? `${p.teacher} (${p.group || 'G?'})` : p.teacher).join(' / ');
      let roomMerged = allRoomsSame ? parsedParts[0].room : parsedParts.map(p => hasGroup ? `${p.group || 'G?'}: ${p.room}` : p.room).join(' / ');

      return { period: periodId, subject: subjectMerged, teacher: teacherMerged, room: roomMerged };
    } else {
      const single = parseSinglePart(raw, defaultRoom, facultyMap);
      let sub = single.subject;
      if (single.group) sub = `${sub} (${single.group})`;
      return { period: periodId, subject: sub, teacher: single.teacher, room: single.room };
    }
  }

  const addLog = (msg, type = 'info') => {
    setParsingLogs(prev => [...prev, { text: msg, type, timestamp: new Date().toLocaleTimeString() }]);
  };

  // Helper to ignore non-timetable reference sheets (e.g. Teacherwise, Lab, Visiting)
  const isIgnoredSheet = (sheetName) => {
    const name = sheetName.toLowerCase();
    return name.includes('teacher') || name.includes('lab') || name.includes('visiting') || name.includes('faculty');
  };

  // Generic block parser for sheets
  const parseSheetBlock = (sheetData, startRow, defaultCourse, defaultSem) => {
    let course = defaultCourse;
    let sem = null;
    let section = 'A';
    let defaultRoom = 'Room 651';

    // Scan metadata rows from startRow to startRow + 6
    for (let i = 0; i <= 6; i++) {
      const row = sheetData[startRow + i] || [];
      const rowStr = row.map(c => clean(c)).join(' ');
      
      if (rowStr.match(/BBA\s*\(?FIA\)?/i)) {
        course = 'BBA FIA';
      } else if (rowStr.match(/\bBMS\b/i)) {
        course = 'BMS';
      } else if (rowStr.match(/B\.?Sc\.?\s*(?:CS|Comp|Computer)/i) || rowStr.match(/\bCS\b/i)) {
        course = 'Bsc Comp Sci';
      }
      
      const semMatch = rowStr.match(/Sem[^\d]*(\d+)/i) || rowStr.match(/(\d+)(?:st|nd|rd|th)?\s*Sem/i) || rowStr.match(/Year[^\d]*(\d+)/i);
      if (semMatch && !sem) {
        sem = semMatch[1];
      }
      
      if (course === 'Bsc Comp Sci') {
        section = 'A';
      } else {
        const secMatch = rowStr.match(/Section\s*([A-D])/i) || rowStr.match(/Sec\s*[-]?\s*([A-D])/i);
        if (secMatch) {
          section = secMatch[1].toUpperCase();
        }
      }

      const roomMatch = rowStr.match(/Room\s*No\.?\s*(\d{3})/i) || rowStr.match(/Room\s*No\.?\s*([A-Za-z0-9]+)/i);
      if (roomMatch) {
        defaultRoom = `Room ${roomMatch[1].trim()}`;
      }
    }

    if (!sem) sem = defaultSem;

    // Find timings row
    let periodRowIdx = -1;
    let timingsRowIdx = -1;

    for (let i = 2; i < 10; i++) {
      const row = sheetData[startRow + i] || [];
      const rowStr = row.map(c => clean(c)).join(' ');
      if (rowStr.includes('Infinity Hour') || (rowStr.includes('I') && rowStr.includes('II') && rowStr.includes('III'))) {
        periodRowIdx = startRow + i;
        timingsRowIdx = periodRowIdx + 1;
        break;
      }
    }

    if (periodRowIdx === -1) return null;

    // Read classes for Monday to Friday
    const dayRows = {};
    for (let i = 1; i <= 8; i++) {
      const row = sheetData[timingsRowIdx + i] || [];
      const dayLabel = clean(row[0]);
      if (DAYS.includes(dayLabel)) {
        dayRows[dayLabel] = row;
      }
    }

    // Find paper & faculty code mapping table below block
    const facultyMap = {};
    for (let r = timingsRowIdx + 6; r < timingsRowIdx + 30; r++) {
      const row = sheetData[r] || [];
      const rowStr = row.map(c => clean(c)).join(' ');

      if (rowStr.includes('SHAHEED SUKHDEV') || rowStr.includes('CLASS TIME TABLE')) {
        break;
      }

      const paperName = clean(row[1]);
      const paperCode = clean(row[4]);
      const facultyName = clean(row[5]);
      const facultyCode = clean(row[7]);

      if (facultyCode && paperName) {
        facultyMap[facultyCode.toLowerCase()] = { facultyName: facultyName || facultyCode, paperName };
      }
      if (paperCode && paperName) {
        facultyMap[paperCode.toLowerCase()] = { facultyName: facultyName || paperCode, paperName };
      }
    }

    // Generate daily schedules
    const weekSchedule = {};
    DAYS.forEach(day => {
      const fullDayName = FULL_DAYS[day];
      const row = dayRows[day] || [];
      const dayClasses = [];

      const periodColumns = [
        { id: 1, col: 1 }, { id: 2, col: 2 }, { id: 3, col: 3 },
        { id: 0, col: 4, isBreak: true },
        { id: 4, col: 5 }, { id: 5, col: 6 }, { id: 6, col: 7 }, { id: 7, col: 8 }
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

    return { course, sem, section, defaultRoom, weekSchedule };
  };

  // Parser for Management (BBA FIA & BMS) Excel
  const selectAndParseMgmtFile = (selectedFile) => {
    setMgmtFile(selectedFile);
    setMgmtParsedData(null);
    setSaveStatus({ type: '', message: '' });
    setIsParsingMgmt(true);
    addLog(`[Management Upload] Selected file: ${selectedFile.name}`, 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const timetables = {};

        workbook.SheetNames.forEach(sheetName => {
          if (isIgnoredSheet(sheetName)) return;

          const sheet = workbook.Sheets[sheetName];
          if (!sheet) return;

          const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          
          const blockStarts = [];
          sheetData.forEach((row, idx) => {
            const rowStr = row.map(c => clean(c)).join(' ').toUpperCase();
            if (
              rowStr.includes('SHAHEED SUKHDEV') || 
              rowStr.includes('CLASS TIME TABLE') ||
              (rowStr.includes('PROGRAMME') && (rowStr.includes('B.SC') || rowStr.includes('BBA') || rowStr.includes('BMS')))
            ) {
              if (blockStarts.length === 0 || idx - blockStarts[blockStarts.length - 1] > 15) {
                blockStarts.push(idx);
              }
            }
          });

          if (blockStarts.length === 0) return;

          addLog(`[Management Upload] Sheet "${sheetName}": Found ${blockStarts.length} block(s) at rows ${blockStarts.join(', ')}`, 'info');

          let defaultSem = '2';
          const semInSheetName = sheetName.match(/Sem[^\d]*(\d+)/i) || sheetName.match(/(\d+)(?:st|nd|rd|th)?\s*Sem/i) || sheetName.match(/\b([1-8])\b/);
          if (semInSheetName) defaultSem = semInSheetName[1];
          let defaultCourse = sheetName.toUpperCase().includes('BBA') ? 'BBA FIA' : 'BMS';

          blockStarts.forEach((startRow, bIdx) => {
            const result = parseSheetBlock(sheetData, startRow, defaultCourse, defaultSem);
            if (result) {
              const { course, sem, section, defaultRoom, weekSchedule } = result;
              addLog(`  -> [Mgmt Block ${bIdx + 1}] Mapped to ${course} Sem ${sem} Section ${section} (${defaultRoom})`, 'info');
              
              if (!timetables[course]) timetables[course] = {};
              if (!timetables[course][sem]) timetables[course][sem] = {};
              timetables[course][sem][section] = weekSchedule;
            }
          });
        });

        if (Object.keys(timetables).length === 0) {
          addLog('[Management Upload] ⚠️ No Management timetable blocks recognized.', 'warning');
        } else {
          setMgmtParsedData(timetables);
          const summaryList = Object.keys(timetables).map(c => `${c}: Sems [${Object.keys(timetables[c]).join(', ')}]`).join(' | ');
          addLog(`[Management Upload] ✓ Successfully parsed Management timetables (${summaryList})!`, 'success');
        }
      } catch (err) {
        addLog(`[Management Upload] Error: ${err.message}`, 'error');
      } finally {
        setIsParsingMgmt(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  // Parser for B.Sc. Computer Science Excel
  const selectAndParseCsFile = (selectedFile) => {
    setCsFile(selectedFile);
    setCsParsedData(null);
    setSaveStatus({ type: '', message: '' });
    setIsParsingCs(true);
    addLog(`[B.Sc. CS Upload] Selected file: ${selectedFile.name}`, 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const timetables = { "Bsc Comp Sci": {} };
        let parsedBlocksCount = 0;

        workbook.SheetNames.forEach(sheetName => {
          if (isIgnoredSheet(sheetName)) return;

          const sheet = workbook.Sheets[sheetName];
          if (!sheet) return;

          const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          const blockStarts = [];

          sheetData.forEach((row, idx) => {
            const rowStr = row.map(c => clean(c)).join(' ').toUpperCase();
            if (
              rowStr.includes('SHAHEED SUKHDEV') || 
              rowStr.includes('CLASS TIME TABLE') ||
              (rowStr.includes('PROGRAMME') && (rowStr.includes('B.SC') || rowStr.includes('COMPUTER SCIENCE')))
            ) {
              if (blockStarts.length === 0 || idx - blockStarts[blockStarts.length - 1] > 15) {
                blockStarts.push(idx);
              }
            }
          });

          if (blockStarts.length === 0) return;

          addLog(`[B.Sc. CS Upload] Sheet "${sheetName}": Found ${blockStarts.length} block(s) at rows ${blockStarts.join(', ')}`, 'info');

          let defaultSem = '2';
          const semMatch = sheetName.match(/Sem[^\d]*(\d+)/i) || sheetName.match(/(\d+)(?:st|nd|rd|th)?\s*Sem/i) || sheetName.match(/\b([1-8])\b/);
          if (semMatch) defaultSem = semMatch[1];

          blockStarts.forEach((startRow, bIdx) => {
            const result = parseSheetBlock(sheetData, startRow, 'Bsc Comp Sci', defaultSem);
            if (result) {
              const { sem, section, defaultRoom, weekSchedule } = result;
              addLog(`  -> [CS Block ${bIdx + 1}] Mapped B.Sc. CS Sem ${sem} Section ${section} (${defaultRoom})`, 'info');
              
              if (!timetables["Bsc Comp Sci"][sem]) timetables["Bsc Comp Sci"][sem] = {};
              timetables["Bsc Comp Sci"][sem][section] = weekSchedule;
              parsedBlocksCount++;
            }
          });
        });

        const derivedSems = Object.keys(timetables["Bsc Comp Sci"]);

        if (parsedBlocksCount === 0 || derivedSems.length === 0) {
          addLog(`[B.Sc. CS Upload] ⚠️ Could not find timetable blocks.`, 'warning');
        } else {
          setCsParsedData(timetables);
          addLog(`[B.Sc. CS Upload] ✓ Derived semester(s): ${derivedSems.join(', ')} (${parsedBlocksCount} block(s) parsed)!`, 'success');
        }
      } catch (err) {
        addLog(`[B.Sc. CS Upload] Error: ${err.message}`, 'error');
      } finally {
        setIsParsingCs(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  // Scrap / Wipe only Management timetables (BBA FIA & BMS)
  const handleScrapMgmtTimetable = async () => {
    if (!window.confirm("Are you sure you want to scrap and remove all active Management timetables (BBA FIA & BMS) from the OS?")) {
      return;
    }
    try {
      setIsSaving(true);
      setSaveStatus({ type: '', message: '' });
      addLog("[System Admin] Scrapping Management timetables from active storage...", "warning");

      const updated = JSON.parse(JSON.stringify(timetable || {}));
      delete updated['BBA FIA'];
      delete updated['BMS'];
      if (updated._meta) {
        delete updated._meta.mgmtFileName;
        delete updated._meta.mgmtUploadTime;
      }

      await updateTimetable(updated);

      setMgmtFile(null);
      setMgmtParsedData(null);

      setSaveStatus({ type: 'success', message: 'Management timetables (BBA FIA & BMS) scrapped successfully!' });
      addLog("[System Admin] ✓ Scrapped Management timetables from active storage.", "success");
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to scrap Management timetables.' });
      addLog(`[System Admin] Error scrapping Management timetables: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Scrap / Wipe only B.Sc. Computer Science timetables
  const handleScrapCsTimetable = async () => {
    if (!window.confirm("Are you sure you want to scrap and remove all active B.Sc. Computer Science timetables from the OS?")) {
      return;
    }
    try {
      setIsSaving(true);
      setSaveStatus({ type: '', message: '' });
      addLog("[System Admin] Scrapping B.Sc. Computer Science timetables from active storage...", "warning");

      const updated = JSON.parse(JSON.stringify(timetable || {}));
      delete updated['Bsc Comp Sci'];
      if (updated._meta) {
        delete updated._meta.csFileName;
        delete updated._meta.csUploadTime;
      }

      await updateTimetable(updated);

      setCsFile(null);
      setCsParsedData(null);

      setSaveStatus({ type: 'success', message: 'B.Sc. Computer Science timetables scrapped successfully!' });
      addLog("[System Admin] ✓ Scrapped B.Sc. Computer Science timetables from active storage.", "success");
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to scrap B.Sc. CS timetables.' });
      addLog(`[System Admin] Error scrapping B.Sc. CS timetables: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Scrap / Wipe all active timetables
  const handleScrapActiveTimetables = async () => {
    if (!window.confirm("Are you sure you want to scrap and wipe all active timetables across the entire SSCBS OS? This action resets the master timetable storage.")) {
      return;
    }
    try {
      setIsSaving(true);
      setSaveStatus({ type: '', message: '' });
      addLog("[System Admin] Scrapping and clearing all active timetables from storage...", "warning");

      await updateTimetable({});

      setMgmtFile(null);
      setCsFile(null);
      setMgmtParsedData(null);
      setCsParsedData(null);

      setSaveStatus({ type: 'success', message: 'All active timetables have been scrapped and reset across the entire OS!' });
      addLog("[System Admin] ✓ Successfully scrapped and cleared all active timetables!", "success");
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to scrap timetables.' });
      addLog(`[System Admin] Error scrapping timetables: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Push combined parsed timetables to Supabase config
  const handlePublishCombinedTimetables = async () => {
    if (!mgmtParsedData && !csParsedData) return;
    setIsSaving(true);
    setSaveStatus({ type: '', message: '' });
    addLog("Merging and publishing combined timetable data to Supabase...", "info");

    try {
      const mergedTimetable = JSON.parse(JSON.stringify(timetable || {}));
      const nowStr = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

      if (!mergedTimetable._meta) mergedTimetable._meta = {};

      if (mgmtParsedData) {
        Object.keys(mgmtParsedData).forEach(cKey => {
          mergedTimetable[cKey] = mgmtParsedData[cKey];
        });
        if (mgmtFile) {
          mergedTimetable._meta.mgmtFileName = mgmtFile.name;
          mergedTimetable._meta.mgmtUploadTime = nowStr;
        }
      }

      if (csParsedData) {
        Object.keys(csParsedData).forEach(cKey => {
          mergedTimetable[cKey] = csParsedData[cKey];
        });
        if (csFile) {
          mergedTimetable._meta.csFileName = csFile.name;
          mergedTimetable._meta.csUploadTime = nowStr;
        }
      }

      await updateTimetable(mergedTimetable);
      setSaveStatus({ type: 'success', message: 'Combined timetable published successfully! All student dashboards have been updated.' });
      addLog("Successfully saved and published updated master timetable!", "success");
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

  if (!isAdmin) {
    return (
      <div className="admin-console-container" style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>
        <h2>Access Denied</h2>
        <p style={{ marginTop: '1rem', color: '#888' }}>
          You do not have administrative privileges to access the SSCBS OS Admin Workspace.
        </p>
        <button 
          onClick={onBack} 
          style={{ 
            marginTop: '2rem', 
            padding: '0.6rem 1.2rem', 
            background: '#8b5cf6', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Go Back to Dashboard
        </button>
      </div>
    );
  }

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
          <span className="admin-email">{user?.email}</span>
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
          <button 
            className={`admin-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Student Demographics
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
          <div className="tab-pane upload-pane-dual">
            <div className="upload-header-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Schedule Upload Center</h3>
                <p className="subtitle-admin">
                  Upload timetables separately for <strong>Management (BBA FIA & BMS)</strong> and <strong>B.Sc. Computer Science</strong>. Both Odd (1, 3, 5, 7) and Even (2, 4, 6, 8) semesters are fully supported.
                </p>
              </div>
              <button 
                className="btn-scrap-timetables"
                onClick={handleScrapActiveTimetables}
                disabled={isSaving}
                title="Wipe all active timetables across the entire OS"
              >
                🗑️ Scrap & Clear All Active Timetables
              </button>
            </div>

            <div className="upload-dual-grid">
              {/* Card 1: Management (BBA FIA / BMS) */}
              <div className="upload-card mgmt-card">
                <div className="upload-card-header">
                  <div className="card-title-group">
                    <span className="card-icon">📊</span>
                    <div>
                      <h4>Management Timetable</h4>
                      <span className="card-subtitle">BBA (FIA) & BMS • Semesters 1–8</span>
                    </div>
                  </div>
                  <div className="card-header-actions">
                    <button 
                      className="btn-card-action-scrap"
                      onClick={handleScrapMgmtTimetable}
                      disabled={isSaving || (!timetable?.['BMS'] && !timetable?.['BBA FIA'])}
                      title="Scrap active Management timetables only"
                    >
                      🗑️ Scrap Mgmt
                    </button>
                    {mgmtParsedData ? (
                      <span className="upload-status-badge success">✓ Ready to Publish</span>
                    ) : mgmtFile ? (
                      <span className="upload-status-badge warning">Parsing...</span>
                    ) : (
                      <span className="upload-status-badge neutral">Awaiting File</span>
                    )}
                  </div>
                </div>

                {/* Active in OS indicator */}
                <div className="active-os-status-box">
                  <div className="active-os-header">
                    <span className="active-os-label">Active Published OS Schedule File:</span>
                    {timetable?._meta?.mgmtFileName && (
                      <span className="active-file-pill">
                        📄 {timetable._meta.mgmtFileName} {timetable._meta.mgmtUploadTime ? `(${timetable._meta.mgmtUploadTime})` : ''}
                      </span>
                    )}
                  </div>
                  {timetable && (timetable['BMS'] || timetable['BBA FIA']) ? (
                    <div className="active-chips-row">
                      {timetable['BMS'] && (
                        <span className="active-chip green">
                          BMS: Sems [{Object.keys(timetable['BMS']).join(', ')}]
                        </span>
                      )}
                      {timetable['BBA FIA'] && (
                        <span className="active-chip green">
                          BBA FIA: Sems [{Object.keys(timetable['BBA FIA']).join(', ')}]
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="active-chip muted">No active Management timetable published</span>
                  )}
                </div>

                <div 
                  className={`dropzone ${mgmtFile ? 'has-file' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      selectAndParseMgmtFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <div className="dropzone-icon">💼</div>
                  {mgmtFile ? (
                    <div className="file-info-box">
                      <span className="file-name-label">{mgmtFile.name}</span>
                      <span className="file-size-label">{Math.round(mgmtFile.size / 1024)} KB</span>
                    </div>
                  ) : (
                    <p className="dropzone-text">
                      Drag & drop Management Excel file here or <label className="file-input-label">browse<input type="file" onChange={(e) => e.target.files && e.target.files[0] && selectAndParseMgmtFile(e.target.files[0])} accept=".xlsx" className="hidden-file-input" /></label>
                    </p>
                  )}
                </div>

                {mgmtParsedData && (
                  <div className="parsed-summary-chip-row">
                    <span className="staged-label">Staged Upload File:</span>
                    {Object.keys(mgmtParsedData).map(course => (
                      <span key={course} className="summary-chip">
                        <strong>{course}</strong>: Sem {Object.keys(mgmtParsedData[course]).join(', ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card 2: B.Sc. Computer Science */}
              <div className="upload-card cs-card">
                <div className="upload-card-header">
                  <div className="card-title-group">
                    <span className="card-icon">💻</span>
                    <div>
                      <h4>B.Sc. Computer Science</h4>
                      <span className="card-subtitle">Computer Science • Semesters 1–8</span>
                    </div>
                  </div>
                  <div className="card-header-actions">
                    <button 
                      className="btn-card-action-scrap"
                      onClick={handleScrapCsTimetable}
                      disabled={isSaving || !timetable?.['Bsc Comp Sci']}
                      title="Scrap active B.Sc. CS timetables only"
                    >
                      🗑️ Scrap CS
                    </button>
                    {csParsedData ? (
                      <span className="upload-status-badge success">✓ Ready to Publish</span>
                    ) : csFile ? (
                      <span className="upload-status-badge warning">Parsing...</span>
                    ) : (
                      <span className="upload-status-badge neutral">Awaiting File</span>
                    )}
                  </div>
                </div>

                {/* Active in OS indicator */}
                <div className="active-os-status-box">
                  <div className="active-os-header">
                    <span className="active-os-label">Active Published OS Schedule File:</span>
                    {timetable?._meta?.csFileName && (
                      <span className="active-file-pill">
                        📄 {timetable._meta.csFileName} {timetable._meta.csUploadTime ? `(${timetable._meta.csUploadTime})` : ''}
                      </span>
                    )}
                  </div>
                  {timetable && timetable['Bsc Comp Sci'] ? (
                    <span className="active-chip green">
                      B.Sc. CS: Sems [{Object.keys(timetable['Bsc Comp Sci']).join(', ')}]
                    </span>
                  ) : (
                    <span className="active-chip muted">No active B.Sc. CS timetable published</span>
                  )}
                </div>

                <div 
                  className={`dropzone ${csFile ? 'has-file' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      selectAndParseCsFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <div className="dropzone-icon">⚡</div>
                  {csFile ? (
                    <div className="file-info-box">
                      <span className="file-name-label">{csFile.name}</span>
                      <span className="file-size-label">{Math.round(csFile.size / 1024)} KB</span>
                    </div>
                  ) : (
                    <p className="dropzone-text">
                      Drag & drop B.Sc. CS Excel file here or <label className="file-input-label">browse<input type="file" onChange={(e) => e.target.files && e.target.files[0] && selectAndParseCsFile(e.target.files[0])} accept=".xlsx" className="hidden-file-input" /></label>
                    </p>
                  )}
                </div>

                {csParsedData && (
                  <div className="parsed-summary-chip-row">
                    <span className="staged-label">Staged Upload File:</span>
                    {Object.keys(csParsedData).map(course => (
                      <span key={course} className="summary-chip">
                        <strong>{course}</strong>: Sem {Object.keys(csParsedData[course]).join(', ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Combined Publish Bar */}
            {(mgmtParsedData || csParsedData) && (
              <div className="combined-publish-bar">
                <div className="publish-summary-text">
                  <span>✓ Ready to publish changes for: </span>
                  <strong>
                    {[
                      mgmtParsedData ? 'Management (BBA/BMS)' : null,
                      csParsedData ? 'B.Sc. Computer Science' : null
                    ].filter(Boolean).join(' & ')}
                  </strong>
                </div>
                <div className="publish-btn-group">
                  <button 
                    className="btn-publish-timetable"
                    onClick={handlePublishCombinedTimetables}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Publishing to OS...' : 'Save & Publish Combined Timetables'}
                  </button>
                  <button 
                    className="btn-discard"
                    onClick={() => {
                      setMgmtFile(null);
                      setCsFile(null);
                      setMgmtParsedData(null);
                      setCsParsedData(null);
                      setParsingLogs([]);
                    }}
                    disabled={isSaving}
                  >
                    Reset All
                  </button>
                </div>
              </div>
            )}

            {/* Console Log Output Window */}
            <div className="pane-right-full">
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
                {(isParsingMgmt || isParsingCs) && (
                  <div className="log-line info loader-log">
                    Parsing spreadsheet rows... <span className="console-spinner"></span>
                  </div>
                )}
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
        ) : activeTab === 'notices' ? (
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

                <div className="form-item-admin">
                  <label htmlFor="notice-event-date">Session / Event Date & Time (Optional)</label>
                  <DateTimePicker
                    id="notice-event-date"
                    label="Select Date & Time of the event/session"
                    value={noticeForm.event_date}
                    onChange={(val) => setNoticeForm(prev => ({ ...prev, event_date: val }))}
                  />
                </div>

                <div className="form-row-admin">
                  <div className="form-item-admin flex-1">
                    <label htmlFor="notice-active-from">Show From (Start Date/Time - Optional)</label>
                    <DateTimePicker
                      id="notice-active-from"
                      label="Select show start time"
                      value={noticeForm.active_from}
                      onChange={(val) => setNoticeForm(prev => ({ ...prev, active_from: val }))}
                    />
                  </div>
                  
                  <div className="form-item-admin flex-1">
                    <label htmlFor="notice-active-to">Hide After (Auto-Expire Date/Time - Optional)</label>
                    <DateTimePicker
                      id="notice-active-to"
                      label="Select auto-delete time"
                      value={noticeForm.active_to}
                      onChange={(val) => setNoticeForm(prev => ({ ...prev, active_to: val }))}
                    />
                  </div>
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
                    {noticesList.map((notice) => {
                      const getNoticeStatus = (n) => {
                        const now = new Date();
                        if (n.active_from && new Date(n.active_from) > now) {
                          return { label: 'Scheduled', class: 'status-scheduled' };
                        }
                        if (n.active_to && new Date(n.active_to) < now) {
                          return { label: 'Expired', class: 'status-expired' };
                        }
                        return { label: 'Active', class: 'status-active' };
                      };
                      const status = getNoticeStatus(notice);

                      return (
                        <div key={notice.id} className="admin-notice-item">
                          <div className="notice-item-meta">
                            <span className={`category-tag tag-${notice.category.toLowerCase()}`}>{notice.category}</span>
                            {notice.society && <span className="notice-item-society">@{notice.society}</span>}
                            <span className={`admin-status-badge ${status.class}`}>{status.label}</span>
                          </div>
                          <h4 className="notice-item-title">{notice.title}</h4>
                          <p className="notice-item-desc">{notice.content.substring(0, 80)}{notice.content.length > 80 ? '...' : ''}</p>
                          
                          {(notice.event_date || notice.active_from || notice.active_to) && (
                            <div className="notice-item-schedule-info">
                              {notice.event_date && <div style={{ color: '#000000', fontWeight: 'bold' }}>📅 Event: {new Date(notice.event_date).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'})}</div>}
                              {notice.active_from && <div>🟢 Start: {new Date(notice.active_from).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'})}</div>}
                              {notice.active_to && <div>🔴 Expire: {new Date(notice.active_to).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'})}</div>}
                            </div>
                          )}

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
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Student Demographics Analytics Tab */
          <div className="tab-pane analytics-pane">
            <div className="analytics-stats-grid">
              <div className="stat-card-admin highlight-online">
                <div className="card-icon">🟢</div>
                <h4>Online Right Now</h4>
                <p className="stat-number live-pulse-text">{onlinePresence.length}</p>
                <p className="stat-subtitle">Students active on OS shell</p>
              </div>
              <div className="stat-card-admin">
                <div className="card-icon">👥</div>
                <h4>Total Students</h4>
                <p className="stat-number">{analyticsUsers.length}</p>
                <p className="stat-subtitle">Registered profiles</p>
              </div>
              <div className="stat-card-admin">
                <div className="card-icon">🏆</div>
                <h4>Top Feature</h4>
                <p className="stat-number text-truncate" style={{ fontSize: '1.25rem' }}>
                  {analyticsSummary.topFeatureName}
                </p>
                <p className="stat-subtitle">{analyticsSummary.topFeatureCount} engagements</p>
              </div>
              <div className="stat-card-admin">
                <div className="card-icon">📊</div>
                <h4>Total Platform Events</h4>
                <p className="stat-number">{analyticsSummary.totals.grandTotal}</p>
                <p className="stat-subtitle">Views & clicks in window</p>
              </div>
            </div>

            {/* REAL-TIME ONLINE PRESENCE ROSTER CARD */}
            <div className="registry-card-admin presence-card-container">
              <div className="chart-header-admin flex-between flex-wrap gap-2">
                <div>
                  <h3>🟢 Real-Time Online Presence Roster</h3>
                  <p className="section-desc-small">
                    Active students currently connected to SSCBS OS shell & features (refreshes live every 1s).
                  </p>
                </div>
                <span className="live-presence-indicator">
                  <span className="pulse-dot-green"></span> {onlinePresence.length} Active Now • Real-Time 1s
                </span>
              </div>

              {onlinePresence.length === 0 ? (
                <div className="no-registry-results">
                  <p>No active students connected right now. Perform actions in the OS shell to trigger real-time presence.</p>
                </div>
              ) : (
                <div className="table-scroll-container-admin">
                  <table className="registry-table-admin presence-table-admin">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Course & Section</th>
                        <th>Active Feature / Page</th>
                        <th>Device Shell</th>
                        <th>Last Ping</th>
                      </tr>
                    </thead>
                    <tbody>
                      {onlinePresence.map((usr) => {
                        const pingDiffSec = Math.max(0, Math.floor((tickerNow - (usr.lastPing || tickerNow)) / 1000));
                        const featKey = usr.currentView || 'home';
                        const featStyleMap = {
                          home: { bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
                          timetable: { bg: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' },
                          'find-prof': { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
                          waiver: { bg: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4', border: 'rgba(6, 182, 212, 0.3)' },
                          gpa: { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
                          buzz: { bg: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', border: 'rgba(236, 72, 153, 0.3)' },
                          admin: { bg: 'rgba(234, 179, 8, 0.12)', color: '#eab308', border: 'rgba(234, 179, 8, 0.3)' }
                        };
                        const chipStyle = featStyleMap[featKey] || featStyleMap.home;

                        return (
                          <tr key={usr.id}>
                            <td>
                              <div className="student-name-cell">
                                <span className="online-avatar-badge">{usr.name ? usr.name.charAt(0).toUpperCase() : 'S'}</span>
                                <div>
                                  <strong className="student-name-text">{usr.name}</strong>
                                  <span className="student-email-text">{usr.email}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="course-sem-chip">
                                {usr.course} • Sem {usr.semester} {usr.section && usr.section !== 'N/A' ? `(${usr.section})` : ''}
                              </span>
                            </td>
                            <td>
                              <span
                                className="active-view-chip"
                                style={{
                                  backgroundColor: chipStyle.bg,
                                  color: chipStyle.color,
                                  border: `1px solid ${chipStyle.border}`,
                                  fontWeight: 700,
                                  padding: '3px 9px',
                                  borderRadius: '6px'
                                }}
                              >
                                ⚡ {usr.viewLabel || FEATURE_NAMES[featKey] || 'Home Dashboard'}
                              </span>
                            </td>
                            <td>
                              <span className="device-chip">{usr.device}</span>
                            </td>
                            <td>
                              <span className="ping-time-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <span className="pulse-dot-green" style={{ width: '6px', height: '6px' }}></span>
                                {pingDiffSec === 0 ? 'Live (Just now)' : `${pingDiffSec}s ago`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* INTERACTIVE TIME-SERIES LINE GRAPH CARD */}
            <div className="registry-card-admin line-graph-card-admin">
              <div className="chart-header-admin flex-between flex-wrap">
                <div>
                  <h3>📈 Feature Usage & Click Analytics (Time-Series)</h3>
                  <p className="section-desc-small">
                    Daily engagement trends across SSCBS OS tools over time. Click legend items below to toggle feature lines.
                  </p>
                </div>
                
                <div className="graph-time-selectors">
                  {[
                    { days: 7, label: 'Last 7 Days' },
                    { days: 30, label: 'Last 30 Days' },
                    { days: 90, label: 'Last 90 Days' }
                  ].map(({ days, label }) => (
                    <button
                      key={days}
                      className={`btn-time-range ${analyticsTimeRange === days ? 'active' : ''}`}
                      onClick={() => setAnalyticsTimeRange(days)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Series Legend Toggles */}
              <div className="graph-legend-toggles">
                {[
                  { key: 'total', label: 'All Platform Views', color: '#eab308' },
                  { key: 'home', label: 'Home Dashboard', color: '#3b82f6' },
                  { key: 'timetable', label: 'Timetable', color: '#8b5cf6' },
                  { key: 'find-prof', label: 'Find My Professor', color: '#10b981' },
                  { key: 'waiver', label: 'Waiver Tool', color: '#06b6d4' },
                  { key: 'gpa', label: 'GPA Calculator', color: '#f59e0b' },
                  { key: 'buzz', label: 'Campus Buzz', color: '#ec4899' }
                ].map(({ key, label, color }) => {
                  const count = key === 'total'
                    ? (analyticsSummary.totals.grandTotal || 0)
                    : (analyticsSummary.totals[key] ?? 0);
                  return (
                    <button
                      key={key}
                      className={`legend-toggle-item ${enabledSeries[key] ? 'active' : 'disabled'}`}
                      onClick={() => toggleSeries(key)}
                    >
                      <span className="legend-dot" style={{ backgroundColor: color }}></span>
                      <span className="legend-name">{label}</span>
                      <span className="legend-count">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* SVG Line Graph Render */}
              <div className="line-graph-wrapper">
                {(() => {
                  const { dateLabels, series } = analyticsSummary;
                  if (!dateLabels || dateLabels.length === 0) return null;

                  const width = 800;
                  const height = 240;
                  const paddingLeft = 45;
                  const paddingRight = 20;
                  const paddingTop = 20;
                  const paddingBottom = 40;
                  const graphWidth = width - paddingLeft - paddingRight;
                  const graphHeight = height - paddingTop - paddingBottom;

                  const seriesColors = {
                    total: '#eab308',
                    home: '#3b82f6',
                    timetable: '#8b5cf6',
                    'find-prof': '#10b981',
                    waiver: '#06b6d4',
                    gpa: '#f59e0b',
                    buzz: '#ec4899'
                  };

                  let maxVal = 10;
                  Object.keys(series).forEach(key => {
                    if (enabledSeries[key]) {
                      const maxInSeries = Math.max(...(series[key] || [0]));
                      if (maxInSeries > maxVal) maxVal = maxInSeries;
                    }
                  });

                  const getX = (idx) => paddingLeft + (idx / Math.max(1, dateLabels.length - 1)) * graphWidth;
                  const getY = (val) => paddingTop + graphHeight - (val / maxVal) * graphHeight;

                  return (
                    <div className="svg-container-rel">
                      <svg viewBox={`0 0 ${width} ${height}`} className="line-graph-svg">
                        {/* Gridlines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                          const val = Math.round(ratio * maxVal);
                          const y = paddingTop + graphHeight - ratio * graphHeight;
                          return (
                            <g key={ratio} className="graph-grid-group">
                              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                              <text x={paddingLeft - 8} y={y + 4} fill="var(--ink-dim)" fontSize="10" textAnchor="end" fontWeight="700">{val}</text>
                            </g>
                          );
                        })}

                        {/* Date Axis Labels */}
                        {dateLabels.map((label, idx) => {
                          const step = Math.max(1, Math.ceil(dateLabels.length / 8));
                          if (idx % step !== 0 && idx !== dateLabels.length - 1) return null;
                          const x = getX(idx);
                          return (
                            <text key={idx} x={x} y={height - 10} fill="var(--ink-dim)" fontSize="10" textAnchor="middle" fontWeight="700">
                              {label}
                            </text>
                          );
                        })}

                        {/* Line Series */}
                        {Object.keys(series).map((seriesKey) => {
                          if (!enabledSeries[seriesKey]) return null;
                          const points = series[seriesKey] || [];
                          if (points.length === 0) return null;
                          const pathData = points.map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`).join(' ');
                          const color = seriesColors[seriesKey] || '#8b5cf6';

                          return (
                            <g key={seriesKey}>
                              <path
                                d={pathData}
                                fill="none"
                                stroke={color}
                                strokeWidth={seriesKey === 'total' ? '3.5' : '2.5'}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity={seriesKey === 'total' ? 0.7 : 0.9}
                              />
                              {points.map((val, idx) => (
                                <circle
                                  key={idx}
                                  cx={getX(idx)}
                                  cy={getY(val)}
                                  r={seriesKey === 'total' ? '4.5' : '3.5'}
                                  fill={color}
                                  stroke="var(--surface)"
                                  strokeWidth="1.5"
                                  className="graph-point-circle"
                                  onMouseEnter={() => setHoveredPoint({ date: dateLabels[idx], seriesKey, val, x: getX(idx), y: getY(val) })}
                                  onMouseLeave={() => setHoveredPoint(null)}
                                />
                              ))}
                            </g>
                          );
                        })}
                      </svg>

                      {/* Hover Tooltip */}
                      {hoveredPoint && (
                        <div
                          className="graph-hover-tooltip"
                          style={{
                            left: `${(hoveredPoint.x / width) * 100}%`,
                            top: `${(hoveredPoint.y / height) * 100}%`
                          }}
                        >
                          <span className="tooltip-date">{hoveredPoint.date}</span>
                          <span className="tooltip-val">
                            <strong>{FEATURE_NAMES[hoveredPoint.seriesKey] || (hoveredPoint.seriesKey === 'total' ? 'All Platform Views' : hoveredPoint.seriesKey.toUpperCase())}</strong>: {hoveredPoint.val} views
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Visual Charts Row */}
            <div className="analytics-charts-row">
              {/* Course Donut Chart */}
              <div className="chart-container-admin">
                <div className="chart-header-admin">
                  <h3>Course Distribution</h3>
                </div>
                {(() => {
                  const bmsCount = analyticsUsers.filter(u => u.course === 'BMS').length;
                  const fiaCount = analyticsUsers.filter(u => u.course === 'BBA FIA').length;
                  const csCount = analyticsUsers.filter(u => u.course === 'Bsc Comp Sci').length;
                  const total = bmsCount + fiaCount + csCount;

                  const bmsPct = total > 0 ? Math.round((bmsCount / total) * 100) : 0;
                  const fiaPct = total > 0 ? Math.round((fiaCount / total) * 100) : 0;
                  const csPct = total > 0 ? 100 - bmsPct - fiaPct : 0;

                  const circ = 314.15;
                  const bmsStroke = (bmsPct / 100) * circ;
                  const fiaStroke = (fiaPct / 100) * circ;
                  const csStroke = (csPct / 100) * circ;

                  return (
                    <div className="donut-chart-wrapper">
                      <div className="donut-svg-container">
                        <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }}>
                          <circle cx="60" cy="60" r="50" fill="transparent" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
                          {bmsPct > 0 && (
                            <circle cx="60" cy="60" r="50" fill="transparent" stroke="#8b5cf6" strokeWidth="10"
                              strokeDasharray={`${bmsStroke} ${circ - bmsStroke}`}
                              strokeDashoffset={0}
                              transform="rotate(-90 60 60)"
                              strokeLinecap="round"
                            />
                          )}
                          {fiaPct > 0 && (
                            <circle cx="60" cy="60" r="50" fill="transparent" stroke="#ec4899" strokeWidth="10"
                              strokeDasharray={`${fiaStroke} ${circ - fiaStroke}`}
                              strokeDashoffset={-bmsStroke}
                              transform="rotate(-90 60 60)"
                              strokeLinecap="round"
                            />
                          )}
                          {csPct > 0 && (
                            <circle cx="60" cy="60" r="50" fill="transparent" stroke="#3b82f6" strokeWidth="10"
                              strokeDasharray={`${csStroke} ${circ - csStroke}`}
                              strokeDashoffset={-(bmsStroke + fiaStroke)}
                              transform="rotate(-90 60 60)"
                              strokeLinecap="round"
                            />
                          )}
                        </svg>
                        <div className="donut-center-text">
                          <span className="donut-center-num">{total}</span>
                          <span className="donut-center-lbl">Users</span>
                        </div>
                      </div>
                      <div className="chart-legend-admin">
                        <div className="legend-item-admin">
                          <span className="legend-color-dot" style={{ backgroundColor: '#8b5cf6' }}></span>
                          <span className="legend-label-text">BMS</span>
                          <span className="legend-val-text">{bmsPct}% ({bmsCount})</span>
                        </div>
                        <div className="legend-item-admin">
                          <span className="legend-color-dot" style={{ backgroundColor: '#ec4899' }}></span>
                          <span className="legend-label-text">BBA FIA</span>
                          <span className="legend-val-text">{fiaPct}% ({fiaCount})</span>
                        </div>
                        <div className="legend-item-admin">
                          <span className="legend-color-dot" style={{ backgroundColor: '#3b82f6' }}></span>
                          <span className="legend-label-text">BSc CS</span>
                          <span className="legend-val-text">{csPct}% ({csCount})</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Semester Distribution Bar Chart */}
              <div className="chart-container-admin">
                <div className="chart-header-admin">
                  <h3>Semester Enrollment</h3>
                </div>
                {(() => {
                  const sem2 = analyticsUsers.filter(u => u.semester === '2').length;
                  const sem4 = analyticsUsers.filter(u => u.semester === '4').length;
                  const sem6 = analyticsUsers.filter(u => u.semester === '6').length;
                  const sem8 = analyticsUsers.filter(u => u.semester === '8').length;
                  const maxVal = Math.max(sem2, sem4, sem6, sem8, 1);

                  const s2Pct = (sem2 / maxVal) * 100;
                  const s4Pct = (sem4 / maxVal) * 100;
                  const s6Pct = (sem6 / maxVal) * 100;
                  const s8Pct = (sem8 / maxVal) * 100;

                  return (
                    <div className="bar-chart-wrapper">
                      <div className="bar-item-admin">
                        <div className="bar-item-label-row">
                          <span>Semester 2 (1st Year)</span>
                          <span>{sem2} Students</span>
                        </div>
                        <div className="bar-track-admin">
                          <div className="bar-fill-admin" style={{ width: `${s2Pct}%`, background: 'linear-gradient(90deg, #8b5cf6, #c084fc)' }} />
                        </div>
                      </div>
                      <div className="bar-item-admin">
                        <div className="bar-item-label-row">
                          <span>Semester 4 (2nd Year)</span>
                          <span>{sem4} Students</span>
                        </div>
                        <div className="bar-track-admin">
                          <div className="bar-fill-admin" style={{ width: `${s4Pct}%`, background: 'linear-gradient(90deg, #8b5cf6, #c084fc)' }} />
                        </div>
                      </div>
                      <div className="bar-item-admin">
                        <div className="bar-item-label-row">
                          <span>Semester 6 (3rd Year)</span>
                          <span>{sem6} Students</span>
                        </div>
                        <div className="bar-track-admin">
                          <div className="bar-fill-admin" style={{ width: `${s6Pct}%`, background: 'linear-gradient(90deg, #8b5cf6, #c084fc)' }} />
                        </div>
                      </div>
                      <div className="bar-item-admin">
                        <div className="bar-item-label-row">
                          <span>Semester 8 (4th Year)</span>
                          <span>{sem8} Students</span>
                        </div>
                        <div className="bar-track-admin">
                          <div className="bar-fill-admin" style={{ width: `${s8Pct}%`, background: 'linear-gradient(90deg, #8b5cf6, #c084fc)' }} />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Searchable Student Directory Card */}
            <div className="registry-card-admin">
              <div className="chart-header-admin">
                <h3>Registered Students Directory</h3>
              </div>
              
              <div className="registry-filters-bar">
                <div className="search-input-wrapper-admin">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by student name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input-admin"
                  />
                </div>
                
                <div className="registry-filters-selects">
                  <select
                    value={filterCourse}
                    onChange={(e) => setFilterCourse(e.target.value)}
                    className="admin-select"
                    style={{ minWidth: '120px' }}
                  >
                    <option value="All">All Courses</option>
                    <option value="BMS">BMS</option>
                    <option value="BBA FIA">BBA FIA</option>
                    <option value="Bsc Comp Sci">BSc CS</option>
                  </select>

                  <select
                    value={filterSem}
                    onChange={(e) => setFilterSem(e.target.value)}
                    className="admin-select"
                    style={{ minWidth: '120px' }}
                  >
                    <option value="All">All Semesters</option>
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                    <option value="3">Semester 3</option>
                    <option value="4">Semester 4</option>
                    <option value="5">Semester 5</option>
                    <option value="6">Semester 6</option>
                    <option value="7">Semester 7</option>
                    <option value="8">Semester 8</option>
                  </select>
                </div>
              </div>

              {loadingAnalytics ? (
                <div className="notices-manager-loading">
                  <span className="console-spinner"></span>
                  <p>Loading student directory...</p>
                </div>
              ) : (() => {
                const filtered = analyticsUsers.filter(u => {
                  const matchSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                      u.email.toLowerCase().includes(searchQuery.toLowerCase());
                  const matchCourse = filterCourse === 'All' || u.course === filterCourse;
                  const matchSem = filterSem === 'All' || u.semester === filterSem;
                  return matchSearch && matchCourse && matchSem;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="no-registry-results">
                      <p>No student profiles match the filter criteria.</p>
                    </div>
                  );
                }

                return (
                  <div className="table-scroll-container-admin">
                    <table className="registry-table-admin">
                      <thead>
                        <tr>
                          <th>Student Name</th>
                          <th>Email Address</th>
                          <th>Course</th>
                          <th>Class</th>
                          <th>Last Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(student => (
                          <tr key={student.id}>
                            <td>
                              <span className="registry-user-avatar">
                                {student.name.charAt(0).toUpperCase()}
                              </span>
                              <strong>{student.name}</strong>
                            </td>
                            <td>{student.email}</td>
                            <td>
                              <span className="registry-badge-course">
                                {student.course}
                              </span>
                            </td>
                            <td>
                              <span className="registry-badge-class">
                                Sem {student.semester} - {student.section}
                              </span>
                            </td>
                            <td>
                              {student.lastActive === 'Online' ? (
                                <span className="registry-status-online">Online</span>
                              ) : (
                                <span className="registry-status-offline">{student.lastActive}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
