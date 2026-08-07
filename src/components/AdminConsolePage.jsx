import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useTimetable } from '../context/TimetableContext';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
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

function AdminConsoleContent({ onBack }) {
  const { user } = useAuth();
  const { featureFlags, updateFeatureFlags } = useConfig();
  const { timetable, updateTimetable, holidays, addHoliday, deleteHoliday } = useTimetable();
  const [activeTab, setActiveTab] = useState('editor'); // 'editor', 'notices', 'analytics', 'holidays', 'settings'

  // Holidays state
  const [holidayForm, setHolidayForm] = useState({ date: '', title: '', message: '', type: 'Holiday' });
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!holidayForm.date || !holidayForm.title) return;
    setIsSavingHoliday(true);
    try {
      await addHoliday(holidayForm);
      setSaveStatus({ type: 'success', message: 'Holiday added successfully!' });
      setHolidayForm({ date: '', title: '', message: '', type: 'Holiday' });
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to add holiday.' });
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    setIsSavingHoliday(true);
    try {
      await deleteHoliday(id);
      setSaveStatus({ type: 'success', message: 'Holiday removed successfully.' });
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to delete holiday.' });
    } finally {
      setIsSavingHoliday(false);
    }
  };



  
  // Notices manager states
  const [noticesList, setNoticesList] = useState([]);
  const [loadingNotices, setLoadingNotices] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState(null);
  const [noticeSubTab, setNoticeSubTab] = useState('live'); // 'live' | 'pending' | 'requests' | 'roster'
  const [pendingNoticeDrafts, setPendingNoticeDrafts] = useState([]);
  const [drafterAccessRequests, setDrafterAccessRequests] = useState([]);
  const [approvedDrafters, setApprovedDrafters] = useState([]);
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    category: 'General',
    society: '',
    venue: '',
    content: '',
    link_url: '',
    event_date: '',
    active_from: '',
    active_to: ''
  });

  const handleEditNoticeClick = (notice) => {
    setEditingNoticeId(notice.id);
    setNoticeForm({
      title: notice.title || '',
      category: notice.category || 'General',
      society: notice.society || '',
      venue: notice.venue || '',
      content: notice.content || '',
      link_url: notice.link_url || '',
      event_date: notice.event_date || '',
      active_from: notice.active_from || '',
      active_to: notice.active_to || ''
    });
    const element = document.querySelector('.notice-creator-card');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCancelEdit = () => {
    setEditingNoticeId(null);
    setNoticeForm({ title: '', category: 'General', society: '', venue: '', content: '', link_url: '', event_date: '', active_from: '', active_to: '' });
  };

  const fetchAdminNotices = async () => {
    if (!hasValidCredentials) {
      setNoticesList([]);
      setPendingNoticeDrafts([]);
      return;
    }
    try {
      setLoadingNotices(true);

      // Delete expired notices
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
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admin notices:', error);
      } else {
        const raw = data || [];
        const live = raw.filter(n => !n.status || n.status === 'published');
        const pending = raw.filter(n => n.status === 'pending');

        const sortedLive = live.sort((a, b) => {
          const orderA = a.display_order ?? 0;
          const orderB = b.display_order ?? 0;
          if (orderA !== orderB) return orderA - orderB;
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });

        setNoticesList(sortedLive);
        setPendingNoticeDrafts(pending);
      }
    } catch (err) {
      console.error('Failed to load notices:', err);
    } finally {
      setLoadingNotices(false);
    }
  };

  const fetchDrafterRequestsAndRoster = async () => {
    if (!hasValidCredentials) return;
    try {
      const { data, error } = await supabase
        .from('notice_drafter_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setDrafterAccessRequests(data.filter(r => r.status === 'pending'));
        setApprovedDrafters(data.filter(r => r.status === 'approved'));
      }
    } catch (err) {
      console.warn('Error fetching drafter requests & roster:', err);
    }
  };

  const handleAcceptNoticeDraft = async (id) => {
    try {
      if (hasValidCredentials) {
        const { error } = await supabase
          .from('notices')
          .update({ status: 'published' })
          .eq('id', id);
        if (error) throw error;
      }
      setPendingNoticeDrafts(prev => prev.filter(n => n.id !== id));
      fetchAdminNotices();
      setSaveStatus({ type: 'success', message: 'Notice accepted & published live!' });
    } catch (err) {
      console.error('Error accepting notice draft:', err);
      setSaveStatus({ type: 'error', message: 'Failed to accept notice draft.' });
    }
  };

  const handleRefuseNoticeDraft = async (id) => {
    if (!window.confirm('Are you sure you want to refuse this notice draft?')) return;
    try {
      if (hasValidCredentials) {
        const { error } = await supabase
          .from('notices')
          .update({ status: 'rejected' })
          .eq('id', id);
        if (error) throw error;
      }
      setPendingNoticeDrafts(prev => prev.filter(n => n.id !== id));
      setSaveStatus({ type: 'success', message: 'Notice draft refused.' });
    } catch (err) {
      console.error('Error refusing notice draft:', err);
      setSaveStatus({ type: 'error', message: 'Failed to refuse notice draft.' });
    }
  };

  const handleGrantDrafterAccess = async (reqId) => {
    try {
      if (hasValidCredentials) {
        const { error } = await supabase
          .from('notice_drafter_requests')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', reqId);
        if (error) throw error;
      }
      fetchDrafterRequestsAndRoster();
      setSaveStatus({ type: 'success', message: 'Drafter access granted successfully!' });
    } catch (err) {
      console.error('Error granting access:', err);
      setSaveStatus({ type: 'error', message: 'Failed to grant access.' });
    }
  };

  const handleDeclineDrafterAccess = async (reqId) => {
    if (!window.confirm('Decline this drafter access request?')) return;
    try {
      if (hasValidCredentials) {
        const { error } = await supabase
          .from('notice_drafter_requests')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .eq('id', reqId);
        if (error) throw error;
      }
      fetchDrafterRequestsAndRoster();
      setSaveStatus({ type: 'success', message: 'Drafter access request declined.' });
    } catch (err) {
      console.error('Error declining request:', err);
      setSaveStatus({ type: 'error', message: 'Failed to decline request.' });
    }
  };

  const handleRevokeDrafterAccess = async (reqId) => {
    if (!window.confirm('Are you sure you want to REVOKE notice drafting access for this user?')) return;
    try {
      if (hasValidCredentials) {
        const { error } = await supabase
          .from('notice_drafter_requests')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .eq('id', reqId);
        if (error) throw error;
      }
      fetchDrafterRequestsAndRoster();
      setSaveStatus({ type: 'success', message: 'Notice drafting access revoked.' });
    } catch (err) {
      console.error('Error revoking access:', err);
      setSaveStatus({ type: 'error', message: 'Failed to revoke access.' });
    }
  };

  const handleReorderNotices = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= noticesList.length) return;

    const newList = [...noticesList];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;

    const updatedList = newList.map((item, idx) => ({
      ...item,
      display_order: idx
    }));

    // 1. Instant local UI update
    setNoticesList(updatedList);

    // 2. Clear local cache & broadcast update event immediately for instant UI sync
    try {
      sessionStorage.removeItem('sscbs_cached_notices');
      sessionStorage.removeItem('sscbs_cached_notices_time');
      window.dispatchEvent(new CustomEvent('sscbs-notices-updated', { detail: updatedList }));
    } catch (e) {}

    // 3. Fast single-batch upsert in Supabase
    if (hasValidCredentials) {
      try {
        const payload = updatedList
          .filter(item => item.id && !String(item.id).startsWith('mock-'))
          .map(item => ({
            id: item.id,
            display_order: item.display_order
          }));

        if (payload.length > 0) {
          const { error } = await supabase
            .from('notices')
            .upsert(payload, { onConflict: 'id' });
          if (error) {
            console.error('Failed to update notice display order in Supabase:', error);
          }
        }
      } catch (err) {
        console.error('Failed to update notice display order in Supabase:', err);
      }
    }
  };

  React.useEffect(() => {
    if (activeTab === 'notices') {
      fetchAdminNotices();
      fetchDrafterRequestsAndRoster();
    } else if (activeTab === 'analytics') {
      fetchDemographicsData();
    }
  }, [activeTab]);

  const handleCreateNotice = async (e) => {
    e.preventDefault();
    if (!noticeForm.title) return;

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
      if (editingNoticeId) {
        // UPDATE EXISTING NOTICE
        if (!hasValidCredentials) {
          setNoticesList(prev => prev.map(n => n.id === editingNoticeId ? {
            ...n,
            title: noticeForm.title,
            content: noticeForm.content || '',
            society: noticeForm.society || null,
            venue: noticeForm.venue || null,
            link_url: noticeForm.link_url || null,
            event_date: eventDateVal,
            active_from: activeFromVal,
            active_to: activeToVal
          } : n));
          setSaveStatus({ type: 'success', message: 'Notice updated successfully!' });
          setEditingNoticeId(null);
          setNoticeForm({ title: '', category: 'General', society: '', venue: '', content: '', link_url: '', event_date: '', active_from: '', active_to: '' });
          setIsSaving(false);
          return;
        }

        const { error } = await supabase
          .from('notices')
          .update({
            title: noticeForm.title,
            content: noticeForm.content || '',
            society: noticeForm.society || null,
            venue: noticeForm.venue || null,
            link_url: noticeForm.link_url || null,
            event_date: eventDateVal,
            active_from: activeFromVal,
            active_to: activeToVal
          })
          .eq('id', editingNoticeId);

        if (error) throw error;

        setSaveStatus({ type: 'success', message: 'Notice updated successfully!' });
        setEditingNoticeId(null);
        setNoticeForm({ title: '', category: 'General', society: '', venue: '', content: '', link_url: '', event_date: '', active_from: '', active_to: '' });
        fetchAdminNotices();
      } else {
        // CREATE NEW NOTICE
        const minOrder = noticesList.length > 0 ? Math.min(...noticesList.map(n => n.display_order ?? 0)) : 0;
        const newDisplayOrder = minOrder - 1;

        if (!hasValidCredentials) {
          const newMockNotice = {
            id: String(Date.now()),
            title: noticeForm.title,
            content: noticeForm.content || '',
            category: noticeForm.category || 'General',
            society: noticeForm.society || null,
            venue: noticeForm.venue || null,
            link_url: noticeForm.link_url || null,
            event_date: eventDateVal,
            active_from: activeFromVal,
            active_to: activeToVal,
            display_order: newDisplayOrder,
            created_at: new Date().toISOString()
          };
          setNoticesList(prev => [newMockNotice, ...prev]);
          setSaveStatus({ type: 'success', message: 'Notice published successfully!' });
          setNoticeForm({ title: '', category: 'General', society: '', venue: '', content: '', link_url: '', event_date: '', active_from: '', active_to: '' });
          setIsSaving(false);
          return;
        }

        const { error } = await supabase
          .from('notices')
          .insert([{
            title: noticeForm.title,
            content: noticeForm.content || '',
            category: noticeForm.category || 'General',
            society: noticeForm.society || null,
            venue: noticeForm.venue || null,
            link_url: noticeForm.link_url || null,
            event_date: eventDateVal,
            active_from: activeFromVal,
            active_to: activeToVal,
            display_order: newDisplayOrder
          }]);

        if (error) throw error;

        setSaveStatus({ type: 'success', message: 'Notice published successfully onto the Campus Notice Board!' });
        setNoticeForm({ title: '', category: 'General', society: '', venue: '', content: '', link_url: '', event_date: '', active_from: '', active_to: '' });
        fetchAdminNotices();
      }
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
        setSaveStatus({ type: 'error', message: err.message || 'Failed to save notice.' });
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
  const [analyticsMetric, setAnalyticsMetric] = useState('combined'); // 'combined' | 'visits' | 'clicks'
  const [analyticsSummary, setAnalyticsSummary] = useState({
    dateLabels: [],
    visits: { totals: {}, series: {} },
    clicks: { totals: {}, series: {} },
    combined: { totals: {}, series: {} },
    series: { total: [], timetable: [], 'find-prof': [], 'team-finder': [], waiver: [], gpa: [], buzz: [], profile: [], admin: [] },
    totals: { timetable: 0, 'find-prof': 0, 'team-finder': 0, waiver: 0, gpa: 0, buzz: 0, profile: 0, admin: 0, grandTotal: 0 },
    topFeatureName: 'Timetable',
    topFeatureCount: 0
  });
  const [enabledSeries, setEnabledSeries] = useState({
    timetable: true,
    'find-prof': true,
    'team-finder': true,
    waiver: true,
    gpa: true,
    buzz: true,
    profile: true
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
      // Mock demographic data sorted by last activity timestamp descending
      const now = Date.now();
      const mockUsers = [
        { id: 'm1', name: 'Aditya Singhani', email: 'aditya.25015@sscbs.du.ac.in', course: 'BMS', semester: '2', section: 'A', lastActiveMs: now - 60000 * 1, lastActive: 'Online' },
        { id: 'm4', name: 'Riya Gupta', email: 'riya.25078@sscbs.du.ac.in', course: 'BBA FIA', semester: '4', section: 'B', lastActiveMs: now - 60000 * 2, lastActive: 'Online' },
        { id: 'm6', name: 'Divya Sen', email: 'divya.25102@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '4', section: 'A', lastActiveMs: now - 60000 * 3, lastActive: '3 mins ago' },
        { id: 'm2', name: 'Manthan Kabra', email: 'manthan.25042@sscbs.du.ac.in', course: 'BMS', semester: '2', section: 'B', lastActiveMs: now - 60000 * 5, lastActive: '5 mins ago' },
        { id: 'm16', name: 'Tushar Mehta', email: 'tushar.25244@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '8', section: 'A', lastActiveMs: now - 60000 * 6, lastActive: '6 mins ago' },
        { id: 'm9', name: 'Ishaan Malhotra', email: 'ishaan.25145@sscbs.du.ac.in', course: 'BMS', semester: '4', section: 'D', lastActiveMs: now - 60000 * 12, lastActive: '12 mins ago' },
        { id: 'm14', name: 'Pranav Shah', email: 'pranav.25201@sscbs.du.ac.in', course: 'BMS', semester: '4', section: 'A', lastActiveMs: now - 60000 * 60, lastActive: '1 hour ago' },
        { id: 'm3', name: 'Kunal Sharma', email: 'kunal.25055@sscbs.du.ac.in', course: 'BBA FIA', semester: '2', section: 'A', lastActiveMs: now - 60000 * 120, lastActive: '2 hours ago' },
        { id: 'm18', name: 'Yash Vardhan', email: 'yash.25266@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '6', section: 'A', lastActiveMs: now - 60000 * 240, lastActive: '4 hours ago' },
        { id: 'm5', name: 'Arjun Verma', email: 'arjun.25091@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '6', section: 'A', lastActiveMs: now - 60000 * 1440, lastActive: '1 day ago' },
        { id: 'm12', name: 'Mehak Preet', email: 'mehak.25189@sscbs.du.ac.in', course: 'BMS', semester: '8', section: 'C', lastActiveMs: now - 60000 * 4320, lastActive: '3 days ago' },
        { id: 'm7', name: 'Siddharth Jain', email: 'sid.25114@sscbs.du.ac.in', course: 'BMS', semester: '6', section: 'A', lastActiveMs: now - 60000 * 10000, lastActive: 'Offline' },
        { id: 'm10', name: 'Ananya Roy', email: 'ananya.25156@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '2', section: 'A', lastActiveMs: now - 60000 * 12000, lastActive: 'Offline' },
        { id: 'm13', name: 'Neil Dsouza', email: 'neil.25199@sscbs.du.ac.in', course: 'BBA FIA', semester: '2', section: 'A', lastActiveMs: now - 60000 * 15000, lastActive: 'Offline' },
        { id: 'm17', name: 'Vanshika Goel', email: 'vansh.25255@sscbs.du.ac.in', course: 'BMS', semester: '6', section: 'C', lastActiveMs: now - 60000 * 20000, lastActive: 'Offline' }
      ];
      mockUsers.sort((a, b) => b.lastActiveMs - a.lastActiveMs);
      setAnalyticsUsers(mockUsers);
      setLoadingAnalytics(false);
      return;
    }

    try {
      // 1. Query registered users and profiles from user_progress
      const { data: progressRows, error: progressError } = await supabase
        .from('user_progress')
        .select('user_id, settings, updated_at');

      // 2. Fetch live presence ping timestamps from active_presence
      let presenceMap = {};
      try {
        const { data: presenceRows } = await supabase
          .from('active_presence')
          .select('user_id, email, last_ping');
        if (presenceRows) {
          presenceRows.forEach(p => {
            const key = p.user_id || p.email;
            if (key) {
              const pingMs = new Date(p.last_ping).getTime();
              if (!isNaN(pingMs)) {
                presenceMap[key] = Math.max(presenceMap[key] || 0, pingMs);
              }
            }
          });
        }
      } catch (e) {}

      // 3. Fetch latest feature activity logs from analytics_events
      let analyticsMap = {};
      try {
        const { data: eventRows } = await supabase
          .from('analytics_events')
          .select('user_id, created_at')
          .order('created_at', { ascending: false })
          .limit(1000);
        if (eventRows) {
          eventRows.forEach(ev => {
            if (ev.user_id) {
              const evMs = new Date(ev.created_at).getTime();
              if (!isNaN(evMs)) {
                analyticsMap[ev.user_id] = Math.max(analyticsMap[ev.user_id] || 0, evMs);
              }
            }
          });
        }
      } catch (e) {}

      if (progressError) {
        console.error('Error fetching demographics:', progressError);
        setSaveStatus({ type: 'error', message: progressError.message || 'Failed to load student demographics.' });
      } else {
        const now = Date.now();
        const formatted = (progressRows || []).map(row => {
          const profile = row.settings || {};
          const updatedAtMs = new Date(row.updated_at).getTime();
          const email = profile.email || '';
          const userId = row.user_id;

          const presenceMs = presenceMap[userId] || presenceMap[email] || 0;
          const eventMs = analyticsMap[userId] || 0;

          // Crucial: Determine absolute latest activity timestamp across all sources
          const lastActiveMs = Math.max(
            isNaN(updatedAtMs) ? 0 : updatedAtMs,
            presenceMs,
            eventMs
          );

          const diffMs = Math.max(0, now - lastActiveMs);

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
            email: email || 'No Email Sync',
            course: profile.course || 'Unset',
            semester: profile.semester ? String(profile.semester) : 'Unset',
            section: profile.section || 'Unset',
            lastActive,
            lastActiveMs
          };
        });

        // SORT DESCENDING BY LAST ACTIVITY TIMESTAMP (MOST RECENT FIRST)
        formatted.sort((a, b) => b.lastActiveMs - a.lastActiveMs);

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
  const [hfApiKey, setHfApiKey] = useState(() => import.meta.env.VITE_HF_API_KEY || '');
  const [showHfKeyInput, setShowHfKeyInput] = useState(false);
  const [aiParseProgress, setAiParseProgress] = useState({ current: 0, total: 0, status: '' });

  // Live Schedule Draft State (combines uploader + live editor)
  const [draftTimetable, setDraftTimetable] = useState(() => JSON.parse(JSON.stringify(timetable || {})));
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);

  useEffect(() => {
    if (!hasUnpublishedChanges && timetable && Object.keys(timetable).length > 0) {
      setDraftTimetable(JSON.parse(JSON.stringify(timetable)));
    }
  }, [timetable, hasUnpublishedChanges]);

  const applyParsedDataToDraft = (filtered, category) => {
    setDraftTimetable(prev => {
      const nextDraft = JSON.parse(JSON.stringify(prev || {}));
      if (!nextDraft._meta) nextDraft._meta = {};
      Object.keys(filtered).forEach(k => {
        nextDraft[k] = filtered[k];
      });
      const catKey = category === 'cs' ? 'cs' : 'mgmt';
      nextDraft._meta[`${catKey}UploadTime`] = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      nextDraft._meta[`${catKey}Source`] = 'AI Text Parser (Draft)';
      return nextDraft;
    });
    setHasUnpublishedChanges(true);

    const firstCourse = Object.keys(filtered)[0];
    if (firstCourse) {
      setSelectedCourse(firstCourse);
      const sems = filtered[firstCourse];
      if (sems) {
        const firstSem = Object.keys(sems)[0];
        if (firstSem) {
          setSelectedSem(firstSem);
          const secs = sems[firstSem];
          if (secs) {
            const firstSec = Object.keys(secs)[0];
            if (firstSec) setSelectedSection(firstSec);
          }
        }
      }
    }
  };

  const handlePublishDraftTimetable = async () => {
    if (!draftTimetable) return;
    setIsSaving(true);
    setSaveStatus({ type: '', message: '' });
    try {
      const mergedToPublish = JSON.parse(JSON.stringify(draftTimetable));
      if (!mergedToPublish._meta) mergedToPublish._meta = {};
      mergedToPublish._meta.lastPublishedAt = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      await updateTimetable(mergedToPublish);
      setHasUnpublishedChanges(false);
      setSaveStatus({ type: 'success', message: '🎉 Master Timetable published successfully! All student dashboards updated.' });
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to publish timetable.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardDraftChanges = () => {
    if (window.confirm('Are you sure you want to discard all unpublished draft changes?')) {
      setDraftTimetable(JSON.parse(JSON.stringify(timetable || {})));
      setHasUnpublishedChanges(false);
      setTextParsedMgmt(null);
      setTextParsedCs(null);
      setSaveStatus({ type: 'info', message: 'Draft changes discarded. Reset to live timetable.' });
    }
  };

  // Text Parser Uploader states
  const [textInputMgmt, setTextInputMgmt] = useState('');
  const [textInputCs, setTextInputCs] = useState('');
  const [textParsedMgmt, setTextParsedMgmt] = useState(null);
  const [textParsedCs, setTextParsedCs] = useState(null);
  const [isParsingTextMgmt, setIsParsingTextMgmt] = useState(false);
  const [isParsingTextCs, setIsParsingTextCs] = useState(false);
  const [textParserLogs, setTextParserLogs] = useState([]);
  const [showPromptExpanded, setShowPromptExpanded] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  const addTextLog = (msg, type = 'info') => {
    setTextParserLogs(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 100));
  };

  // ══════════════════════════════════════════════
  // AI PROMPT FOR CLAUDE / CHATGPT
  // ══════════════════════════════════════════════
  const TIMETABLE_AI_PROMPT = `You are a precise timetable extractor for Shaheed Sukhdev College of Business Studies (SSCBS), University of Delhi.

I have attached an Excel timetable file. Read EVERY sheet and extract ALL timetable blocks. Output them in the EXACT structured text format described below. Do NOT skip any section, semester, or day.

═══════════════════════════════════════════════
UNDERSTANDING THE EXCEL STRUCTURE
═══════════════════════════════════════════════

Each Excel file contains multiple timetable blocks. Each block has this layout:

1. HEADER ROWS (first 3-4 rows of each block):
   - Row 1: "SHAHEED SUKHDEV COLLEGE OF BUSINESS STUDIES (University of Delhi)"
   - Row 2: "CLASS TIME TABLE"
   - Row 3: Academic Session, Year, Semester, Section info
   - Row 4: Course name (BMS / BBA(FIA) / B.SC.(H) COMPUTER SCIENCE), effective date, Room Name, Room Number

2. PERIOD HEADER ROW:
   - Columns: Day | I | II | III | Infinity Hour | IV | V | VI | VII
   - Period timings: 9-10am, 10-11am, 11am-12pm, BREAK 12-1pm, 1-2pm, 2-3pm, 3-4pm, 4-5pm

3. SCHEDULE ROWS (5 rows, one per weekday):
   - Monday through Friday
   - Each cell contains a faculty code (e.g., "MV", "SP", "RRS") that maps to a professor and subject via the LEGEND TABLE below

4. LEGEND TABLE (below each timetable grid):
   - Headers: S.No. | Paper Type | Paper Name | Faculty Name | Faculty Code | Faculty Load
   - Maps each short faculty code to the full paper name and full faculty name
   - Paper types include: Core, GE, SEC, DSE, VAC, AEC, AECC, DSC

═══════════════════════════════════════════════
CRITICAL EXTRACTION RULES
═══════════════════════════════════════════════

RULE 1 — FACULTY CODE RESOLUTION (MOST IMPORTANT):
  Every cell in the timetable grid contains faculty codes (e.g., "MV", "SP", "Deepali", "Sanchi").
  You MUST look up each code in that block's LEGEND TABLE to get:
    - The FULL faculty name (e.g., "MV" → "Dr. Mona Verma")
    - The FULL paper/subject name (e.g., "MV" → "Statistics for Business Decisions")
  NEVER guess. ALWAYS use the legend.

RULE 2 — COURSE NAME NORMALIZATION:
  - "BMS" → output as "BMS"
  - "BBA(FIA)" or "BBA (FIA)" → output as "BBA FIA"
  - "B.SC.(H) COMPUTER SCIENCE" → output as "Bsc Comp Sci"

RULE 3 — HANDLING ANNOTATIONS IN CELLS:
  Cells often have annotations. Parse them carefully:
  - "(P)" or "(Prac)" = Practical class. Include "(Practical)" in the subject name.
  - "(Tute)" = Tutorial. Include "(Tutorial)" in the subject name.
  - "(237)" or "(Room 651)" = Room number override. Extract as "Room 237" or "Room 651".
  - "(703/651)" = Split rooms. Output as "Room 703 / Room 651".
  - "(Merged with BMS 3A)" = Merged class info. Include in subject but NOT in teacher name.
  - "(Unsupervised)" = No teacher present. Subject becomes "Free", teacher becomes "-".
  - "EE-1 (P) (Unsupervised)" or "C&I (P) (Unsupervised)" or "SOFP (P) (Unsupervised)" = Free period, teacher is "-".
  - "Lab 426" or "Lab 460" = Room override to "Lab 426" or "Lab 460".
  - "(SEC Room)" = Use default room.

RULE 4 — GROUP SPLITS (G1 / G2):
  When a cell contains a "/" separating two group assignments:
  Example: "SJ G1/ MV G2(337)"
  This means:
    - Group 1 (G1): Subject from SJ's legend entry, Teacher: full name of SJ, Room: default room
    - Group 2 (G2): Subject from MV's legend entry, Teacher: full name of MV, Room: Room 337
  Output format:
    subject: "G1: [Subject1] | G2: [Subject2]"
    teacher: "[Full Name 1] (G1) / [Full Name 2] (G2)"
    room: "G1: Room XXX / G2: Room YYY"
  
  If both groups have the SAME subject, just write the subject once:
    subject: "[Subject Name]"
    teacher: "[Full Name 1] (G1) / [Full Name 2] (G2)"

RULE 5 — ELECTIVE / LANGUAGE SPLITS:
  Some cells list multiple language sections:
  Example: "Garima (Hin A) 607 / Soumya (Hin C) 644 / Komal (Hin D) 648"
  Output:
    subject: "Hindi A / Hindi C / Hindi D"
    teacher: "Dr. Garima Tripathi / Dr. Soumya Guliyan / Mr. Komal"
    room: "Room 607 / Room 644 / Room 648"

RULE 6 — EMPTY CELLS = FREE PERIOD:
  If a cell for a period is empty or missing:
    subject: "Free"
    teacher: "-"
    room: "-"

RULE 7 — ROOM NUMBER FORMAT:
  - Always prefix with "Room " (e.g., "Room 703", "Room 607")
  - Exception: "Lab 426", "Lab 460" stay as-is
  - If no room is specified in the cell, use the DEFAULT ROOM from the block header

RULE 8 — PERIOD NUMBERING:
  Period I = P1, Period II = P2, Period III = P3, then BREAK, then Period IV = P4, Period V = P5, Period VI = P6, Period VII = P7

═══════════════════════════════════════════════
REQUIRED OUTPUT FORMAT
═══════════════════════════════════════════════

Output EVERY timetable block in this EXACT format. Do not deviate.

=== [COURSE] | Semester [N] | Section [X] | [Default Room] ===
Monday:
  P1: [Subject Name] | [Full Teacher Name] | [Room]
  P2: [Subject Name] | [Full Teacher Name] | [Room]
  P3: [Subject Name] | [Full Teacher Name] | [Room]
  BREAK
  P4: [Subject Name] | [Full Teacher Name] | [Room]
  P5: [Subject Name] | [Full Teacher Name] | [Room]
  P6: [Subject Name] | [Full Teacher Name] | [Room]
  P7: [Subject Name] | [Full Teacher Name] | [Room]
Tuesday:
  P1: ...
  ...
Wednesday:
  ...
Thursday:
  ...
Friday:
  ...

IMPORTANT FORMATTING RULES:
- Every day MUST have exactly 7 period lines (P1-P3, BREAK, P4-P7)
- Use "Free | - | -" for empty/free periods
- Use "Free | - | -" for unsupervised periods
- The BREAK line has no subject/teacher/room, just the word "BREAK"
- Separate blocks with a blank line
- Use the FULL faculty name from the legend (e.g., "Dr. Mona Verma", NOT "MV")
- Use the FULL subject name from the legend (e.g., "Statistics for Business Decisions", NOT "SBD")
- Include "(Practical)" or "(Tutorial)" in the subject name where applicable
- For teacher names, use the exact prefix from the legend: Dr., Mr., Ms., Prof.

Now extract ALL timetable blocks from the attached Excel file.`;

  // ══════════════════════════════════════════════
  // DETERMINISTIC TEXT PARSER (Fallback / Primary)
  // ══════════════════════════════════════════════
  const parseStructuredText = (text) => {
    const timetables = {};
    const blocks = text.split(/^===\s*/m).filter(b => b.trim());
    let parsedCount = 0;
    let errorCount = 0;

    for (const block of blocks) {
      try {
        // Parse header: [COURSE] | Semester [N] | Section [X] | [Room] ===
        const headerEnd = block.indexOf('===');
        const headerLine = headerEnd > -1 ? block.substring(0, headerEnd).trim() : block.split('\n')[0].trim();
        const bodyText = headerEnd > -1 ? block.substring(headerEnd + 3).trim() : block.substring(block.indexOf('\n')).trim();

        const headerParts = headerLine.split('|').map(s => s.trim());
        if (headerParts.length < 3) continue;

        let course = headerParts[0].trim();
        // Normalize course names
        if (course.includes('BBA') && (course.includes('FIA') || course.includes('(FIA)'))) course = 'BBA FIA';
        else if (course.toLowerCase().includes('bsc') || course.toLowerCase().includes('comp') || course.toLowerCase().includes('computer')) course = 'Bsc Comp Sci';
        else if (course.includes('BMS')) course = 'BMS';

        const semMatch = headerParts[1].match(/(\d+)/);
        const sem = semMatch ? semMatch[1] : '1';

        const secMatch = headerParts[2].match(/([A-D])/i);
        const section = secMatch ? secMatch[1].toUpperCase() : 'A';

        let defaultRoom = headerParts.length >= 4 ? headerParts[3].trim() : 'Room 703';
        if (defaultRoom.endsWith('===')) defaultRoom = defaultRoom.replace(/=+$/, '').trim();
        if (!defaultRoom.toLowerCase().startsWith('room') && !defaultRoom.toLowerCase().startsWith('lab')) {
          defaultRoom = 'Room ' + defaultRoom.replace(/^Room\s*/i, '');
        }

        // Parse days
        const weekSchedule = {};
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const dayPattern = /^(Monday|Tuesday|Wednesday|Thursday|Friday)\s*:/im;
        
        const dayBlocks = [];
        const lines = bodyText.split('\n');
        let currentDay = null;
        let currentLines = [];

        for (const line of lines) {
          const dayMatch = line.match(dayPattern);
          if (dayMatch) {
            if (currentDay) dayBlocks.push({ day: currentDay, lines: currentLines });
            currentDay = dayMatch[1];
            currentLines = [];
          } else if (currentDay) {
            currentLines.push(line);
          }
        }
        if (currentDay) dayBlocks.push({ day: currentDay, lines: currentLines });

        for (const dayName of dayNames) {
          const dayBlock = dayBlocks.find(d => d.day === dayName);
          const dayClasses = [];

          if (dayBlock) {
            const periodLines = dayBlock.lines.filter(l => l.trim());
            let periodIdx = 0;
            const periodIds = [1, 2, 3, 0, 4, 5, 6, 7];

            for (const pLine of periodLines) {
              const trimmed = pLine.trim();
              if (trimmed === 'BREAK' || trimmed.toLowerCase().includes('break')) {
                dayClasses.push({ period: 0, isBreak: true, subject: 'Infinity Hour (Break)', teacher: '', room: '' });
                periodIdx++;
                continue;
              }

              const pMatch = trimmed.match(/^P(\d):\s*(.*)/);
              if (pMatch) {
                const pNum = parseInt(pMatch[1]);
                const content = pMatch[2].trim();
                const parts = content.split('|').map(s => s.trim());

                const subject = parts[0] || 'Free';
                const teacher = parts.length > 1 ? parts[1] : '-';
                const room = parts.length > 2 ? parts[2] : (subject === 'Free' ? '-' : defaultRoom);

                dayClasses.push({ period: pNum, subject, teacher, room });
                periodIdx++;
              }
            }
          }

          // Fill missing periods
          if (dayClasses.length === 0) {
            [1, 2, 3].forEach(p => dayClasses.push({ period: p, subject: 'Free', teacher: '-', room: '-' }));
            dayClasses.push({ period: 0, isBreak: true, subject: 'Infinity Hour (Break)', teacher: '', room: '' });
            [4, 5, 6, 7].forEach(p => dayClasses.push({ period: p, subject: 'Free', teacher: '-', room: '-' }));
          } else if (!dayClasses.find(c => c.isBreak)) {
            // Insert break after P3 if missing
            const breakIdx = dayClasses.findIndex(c => c.period === 4);
            if (breakIdx > -1) {
              dayClasses.splice(breakIdx, 0, { period: 0, isBreak: true, subject: 'Infinity Hour (Break)', teacher: '', room: '' });
            }
          }

          weekSchedule[dayName] = dayClasses;
        }

        if (!timetables[course]) timetables[course] = {};
        if (!timetables[course][sem]) timetables[course][sem] = {};
        timetables[course][sem][section] = weekSchedule;
        parsedCount++;
      } catch (err) {
        errorCount++;
        console.warn('Error parsing block:', err);
      }
    }

    return { timetables, parsedCount, errorCount };
  };

  // ══════════════════════════════════════════════
  // HUGGING FACE TEXT-TO-JSON PARSER
  // ══════════════════════════════════════════════
  const parseTextWithHuggingFace = async (text, category) => {
    const token = hfApiKey || import.meta.env.VITE_HF_API_KEY || '';
    const isCs = category === 'cs';
    const setIsParsingFn = isCs ? setIsParsingTextCs : setIsParsingTextMgmt;
    const setParsedDataFn = isCs ? setTextParsedCs : setTextParsedMgmt;
    const label = isCs ? 'B.Sc. CS' : 'Management';

    setIsParsingFn(true);
    addTextLog(`[${label}] Starting text parse...`, 'info');

    try {
      // ALWAYS try deterministic parser first (it's reliable for our format)
      const { timetables, parsedCount, errorCount } = parseStructuredText(text);

      if (parsedCount > 0) {
        // Filter by category
        const filtered = {};
        for (const [courseName, sems] of Object.entries(timetables)) {
          if (isCs && courseName === 'Bsc Comp Sci') {
            filtered[courseName] = sems;
          } else if (!isCs && (courseName === 'BMS' || courseName === 'BBA FIA')) {
            filtered[courseName] = sems;
          }
        }

        if (Object.keys(filtered).length > 0) {
          setParsedDataFn(filtered);
          applyParsedDataToDraft(filtered, category);
          const summary = Object.entries(filtered).map(([c, sems]) =>
            `${c}: Sems [${Object.keys(sems).sort().join(', ')}] (${Object.values(sems).map(s => Object.keys(s).join(',')).join('; ')})`
          ).join(' | ');
          addTextLog(`[${label}] ✅ Parsed ${parsedCount} block(s) and auto-loaded into Live Editor draft below! ${summary}`, 'success');
          setSaveStatus({ type: 'success', message: `Parsed ${label} schedule and auto-loaded into Live Editor draft. Review below and click "Publish Timetable to Live OS".` });
          if (errorCount > 0) addTextLog(`[${label}] ⚠️ ${errorCount} block(s) had parsing errors.`, 'warning');
        } else {
          addTextLog(`[${label}] ⚠️ Parsed ${parsedCount} block(s) but none matched ${label} courses. Check that the text contains the right course blocks.`, 'warning');
        }
      } else {
        // If deterministic parser finds nothing, try HF as fallback
        if (token) {
          addTextLog(`[${label}] Deterministic parser found no blocks. Trying Hugging Face...`, 'info');
          try {
            const systemPrompt = `Convert this structured timetable text into a JSON object. The JSON must have the structure: { "courseName": { "semesterNumber": { "sectionLetter": { "Monday": [...periods], "Tuesday": [...], "Wednesday": [...], "Thursday": [...], "Friday": [...] } } } }. Each period is: { "period": N, "subject": "...", "teacher": "...", "room": "..." }. The break period has: { "period": 0, "isBreak": true, "subject": "Infinity Hour (Break)", "teacher": "", "room": "" }. Course names must be exactly: "BMS", "BBA FIA", or "Bsc Comp Sci". Return ONLY the raw JSON, no markdown.`;

            const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                model: 'Qwen/Qwen2.5-72B-Instruct',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: `Convert this timetable text to JSON:\n\n${text}` }
                ],
                max_tokens: 8192,
                temperature: 0.05
              })
            });

            if (res.ok) {
              const data = await res.json();
              let rawText = data.choices?.[0]?.message?.content || '';
              rawText = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
              rawText = rawText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
              const jsonMatch = rawText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const hfResult = JSON.parse(jsonMatch[0]);
                const filtered = {};
                for (const [courseName, sems] of Object.entries(hfResult)) {
                  if (isCs && courseName === 'Bsc Comp Sci') filtered[courseName] = sems;
                  else if (!isCs && (courseName === 'BMS' || courseName === 'BBA FIA')) filtered[courseName] = sems;
                }
                if (Object.keys(filtered).length > 0) {
                  setParsedDataFn(filtered);
                  applyParsedDataToDraft(filtered, category);
                  addTextLog(`[${label}] ✅ HF AI parsed successfully and loaded into Live Editor draft below!`, 'success');
                  setSaveStatus({ type: 'success', message: `Parsed ${label} schedule via HF AI and loaded into Live Editor draft. Review below and click "Publish Timetable to Live OS".` });
                } else {
                  addTextLog(`[${label}] ⚠️ HF returned data but no matching ${label} courses found.`, 'warning');
                }
              } else {
                addTextLog(`[${label}] ⚠️ HF response did not contain valid JSON.`, 'warning');
              }
            } else {
              addTextLog(`[${label}] ⚠️ HF API error (${res.status}). Check your API key.`, 'warning');
            }
          } catch (hfErr) {
            addTextLog(`[${label}] ❌ HF error: ${hfErr.message}`, 'error');
          }
        } else {
          addTextLog(`[${label}] ❌ No timetable blocks found in the text. Make sure the text follows the === COURSE | Semester N | Section X | Room === format.`, 'error');
        }
      }
    } catch (err) {
      addTextLog(`[${label}] ❌ Parse error: ${err.message}`, 'error');
    } finally {
      setIsParsingFn(false);
    }
  };

  // Publish text-parsed timetables
  const handlePublishTextMgmt = async () => {
    if (!textParsedMgmt) return;
    setIsSaving(true);
    setSaveStatus({ type: '', message: '' });
    addTextLog('[Management] Publishing parsed timetables to SSCBS OS...', 'info');
    try {
      const merged = JSON.parse(JSON.stringify(timetable || {}));
      if (!merged._meta) merged._meta = {};
      Object.keys(textParsedMgmt).forEach(k => { merged[k] = textParsedMgmt[k]; });
      merged._meta.mgmtUploadTime = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      merged._meta.mgmtSource = 'AI Text Parser';
      await updateTimetable(merged);
      setSaveStatus({ type: 'success', message: 'Management timetables published successfully! All student dashboards updated.' });
      addTextLog('[Management] ✅ Published successfully!', 'success');
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to publish Management timetables.' });
      addTextLog(`[Management] ❌ Publish error: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishTextCs = async () => {
    if (!textParsedCs) return;
    setIsSaving(true);
    setSaveStatus({ type: '', message: '' });
    addTextLog('[B.Sc. CS] Publishing parsed timetables to SSCBS OS...', 'info');
    try {
      const merged = JSON.parse(JSON.stringify(timetable || {}));
      if (!merged._meta) merged._meta = {};
      Object.keys(textParsedCs).forEach(k => { merged[k] = textParsedCs[k]; });
      merged._meta.csUploadTime = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      merged._meta.csSource = 'AI Text Parser';
      await updateTimetable(merged);
      setSaveStatus({ type: 'success', message: 'B.Sc. Computer Science timetables published successfully!' });
      addTextLog('[B.Sc. CS] ✅ Published successfully!', 'success');
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to publish B.Sc. CS timetables.' });
      addTextLog(`[B.Sc. CS] ❌ Publish error: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(TIMETABLE_AI_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2500);
    } catch {
      // Fallback for insecure contexts
      const ta = document.createElement('textarea');
      ta.value = TIMETABLE_AI_PROMPT;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2500);
    }
  };

  const getTextParseSummary = (parsed) => {
    if (!parsed) return [];
    const items = [];
    for (const [course, sems] of Object.entries(parsed)) {
      for (const [sem, sections] of Object.entries(sems)) {
        items.push({ course, sem, sections: Object.keys(sections).sort().join(', ') });
      }
    }
    return items;
  };

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
    let explicitSubject = "";

    // Extract explicit subject tags like (Hin A), (Hin B), (Hin C), (Hin D)
    const hinMatch = partText.match(/\((Hin(?:di)?\s*([A-D]))\)/i);
    if (hinMatch) {
      explicitSubject = `Hindi ${hinMatch[2].toUpperCase()}`;
      partText = partText.replace(/\(Hin(?:di)?\s*[A-D]\)/i, '').trim();
    }

    let groupLabel = '';

    const groupRegexPattern = /\(((?:[GP][1-4]\s*[\+\/]\s*[GP][1-4])|[GP][1-4])\)/i;
    const groupRegexRawPattern = /\b((?:[GP][1-4]\s*[\+\/]\s*[GP][1-4])|[GP][1-4])\b/i;
    const parenGroupMatch = partText.match(groupRegexPattern) || partText.match(groupRegexRawPattern);
    if (parenGroupMatch) {
      groupLabel = parenGroupMatch[1].toUpperCase().replace(/\s+/g, '');
      partText = partText.replace(parenGroupMatch[0], '').trim();
    }

    const roomMatch = partText.match(/\(([^)]+)\)/);
    if (roomMatch) {
      const roomVal = roomMatch[1];
      partRoom = roomVal.split('/').map(r => r.trim().match(/^\d+/) ? 'Room ' + r.trim() : r.trim()).join(' / ');
      partText = partText.replace(/\([^)]+\)/, '').trim();
    }

    const endRoomMatch = partText.match(/\b(?:L|R|Room)?\s*(\d{3})\b/i);
    if (endRoomMatch) {
      partRoom = 'Room ' + endRoomMatch[1];
      partText = partText.replace(endRoomMatch[0], '').trim();
    }

    let teacherCodeLower = partText.trim().toLowerCase();
    let subjectName = explicitSubject || partText.trim();
    let teacherName = partText.trim();

    const codeParenMatch = partText.match(/^([A-Za-z0-9\s]+)\s*\(([^)]+)\)$/);
    if (codeParenMatch) {
      const c1 = codeParenMatch[1].trim().toLowerCase();
      const c2 = codeParenMatch[2].trim().toLowerCase();
      if (facultyMap[c1]) {
        teacherName = facultyMap[c1].facultyName;
        subjectName = explicitSubject || (facultyMap[c2] ? facultyMap[c2].paperName : (facultyMap[c1].paperName || codeParenMatch[2]));
      } else if (facultyMap[c2]) {
        teacherName = facultyMap[c2].facultyName;
        subjectName = explicitSubject || facultyMap[c2].paperName;
      }
    } else if (facultyMap[teacherCodeLower]) {
      if (!explicitSubject) {
        subjectName = facultyMap[teacherCodeLower].paperName;
      } else if (facultyMap[teacherCodeLower].paperName.includes('Merged with')) {
        const mergeMatch = facultyMap[teacherCodeLower].paperName.match(/\(Merged with [^)]+\)/);
        if (mergeMatch) subjectName = `${explicitSubject} ${mergeMatch[0]}`;
      }
      teacherName = facultyMap[teacherCodeLower].facultyName;
    } else {
      const keys = Object.keys(facultyMap);
      for (let k of keys) {
        if (teacherCodeLower && (teacherCodeLower.includes(k) || k.includes(teacherCodeLower))) {
          if (!explicitSubject) {
            subjectName = facultyMap[k].paperName;
          } else if (facultyMap[k].paperName.includes('Merged with')) {
            const mergeMatch = facultyMap[k].paperName.match(/\(Merged with [^)]+\)/);
            if (mergeMatch) subjectName = `${explicitSubject} ${mergeMatch[0]}`;
          }
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

      if (hasGroup) {
        parsedParts.forEach((p, idx) => {
          if (!p.group) {
            const sibling = parsedParts.find((sp, sIdx) => sIdx !== idx && sp.group);
            if (sibling && sibling.group) {
              if (sibling.group === 'G1') p.group = 'P2';
              else if (sibling.group === 'G2') p.group = 'P1';
              else if (sibling.group === 'P1') p.group = 'P2';
              else if (sibling.group === 'P2') p.group = 'P1';
              else p.group = idx === 0 ? 'P1' : 'P2';
            } else {
              p.group = idx === 0 ? 'P1' : 'P2';
            }
          }
        });
      }

      let subjectMerged = allSubjectsSame ? parsedParts[0].subject : parsedParts.map((p, idx) => hasGroup ? `${p.group || (idx === 0 ? 'P1' : 'P2')}: ${p.subject}` : p.subject).join(' | ');
      let teacherMerged = parsedParts.map((p, idx) => hasGroup ? `${p.teacher} (${p.group || (idx === 0 ? 'P1' : 'P2')})` : p.teacher).join(' / ');
      let roomMerged = allRoomsSame ? parsedParts[0].room : parsedParts.map((p, idx) => hasGroup ? `${p.group || (idx === 0 ? 'P1' : 'P2')}: ${p.room}` : p.room).join(' / ');

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
      
      const semMatch = rowStr.match(/Sem\s*[-:\s]?\s*(\d+)/i) || rowStr.match(/(\d+)(?:st|nd|rd|th)?\s*Sem/i);
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

    // Read classes for Monday to Friday by dynamically locating the day column
    const dayRows = {};
    for (let r = timingsRowIdx + 1; r <= timingsRowIdx + 10; r++) {
      const row = sheetData[r] || [];
      for (let c = 0; c < row.length; c++) {
        const val = clean(row[c]);
        if (DAYS.includes(val)) {
          dayRows[val] = { row, dayCol: c };
          break;
        }
      }
    }

    // Find paper & faculty code mapping table below block
    const facultyMap = {};
    for (let r = timingsRowIdx + 7; r < timingsRowIdx + 35; r++) {
      const row = sheetData[r] || [];
      const rowStr = row.map(c => clean(c)).join(' ');

      if (rowStr.includes('SHAHEED SUKHDEV') || rowStr.includes('CLASS TIME TABLE')) {
        break;
      }

      let paperName = '';
      let facultyName = '';
      let facultyCode = '';

      for (let c = 0; c < row.length; c++) {
        const val = clean(row[c]);
        if (val.startsWith('Dr.') || val.startsWith('Mr.') || val.startsWith('Ms.') || val.startsWith('Prof.')) {
          facultyName = val;
          for (let p = c - 1; p >= 0; p--) {
            const pVal = clean(row[p]);
            if (pVal && pVal !== 'Core' && pVal !== 'GE' && pVal !== 'SEC' && pVal !== 'VAC' && pVal !== 'AEC' && !pVal.match(/^\d+$/)) {
              paperName = pVal;
              break;
            }
          }
          for (let codeIdx = c + 1; codeIdx < row.length; codeIdx++) {
            const codeVal = clean(row[codeIdx]);
            if (codeVal && !codeVal.includes('Th') && !codeVal.includes('Prac') && !codeVal.includes('Tute') && !codeVal.includes('Load')) {
              facultyCode = codeVal;
              break;
            }
          }
          break;
        }
      }

      if (facultyCode && paperName && facultyName) {
        facultyMap[facultyCode.toLowerCase()] = { facultyName, paperName };
      }
    }

    // Generate daily schedules
    const weekSchedule = {};
    DAYS.forEach(day => {
      const fullDayName = FULL_DAYS[day];
      const dayInfo = dayRows[day];
      const dayClasses = [];

      const periodColumns = [
        { id: 1, relCol: 1 },
        { id: 2, relCol: 2 },
        { id: 3, relCol: 3 },
        { id: 0, relCol: 4, isBreak: true },
        { id: 4, relCol: 5 },
        { id: 5, relCol: 6 },
        { id: 6, relCol: 7 },
        { id: 7, relCol: 8 }
      ];

      periodColumns.forEach(({ id, relCol, isBreak }) => {
        if (isBreak) {
          dayClasses.push({ period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" });
          return;
        }

        if (!dayInfo) {
          dayClasses.push({ period: id, subject: "Free", teacher: "-", room: "-" });
          return;
        }

        const cellValue = clean(dayInfo.row[dayInfo.dayCol + relCol]);
        const parsedCell = parseUnifiedCell(cellValue, id, facultyMap, defaultRoom);
        dayClasses.push(parsedCell);
      });

      weekSchedule[fullDayName] = dayClasses;
    });

    return { course, sem, section, defaultRoom, weekSchedule };
  };

  // AI-Powered Timetable Parser (Hugging Face Inference API)
  const parseFileWithHuggingFace = async (selectedFile) => {
    if (!selectedFile) return;
    const token = hfApiKey || import.meta.env.VITE_HF_API_KEY || '';
    if (!token) {
      addLog('[AI Parser] ⚠️ No Hugging Face API key configured. Click "⚙️ Configure HF Token" to add your free token from huggingface.co/settings/tokens', 'warning');
      addLog('[AI Parser] Falling back to smart rule-based parser...', 'info');
    }
    addLog(`[AI Parser] Reading file "${selectedFile.name}"...`, 'info');
    setIsParsingMgmt(true);
    setAiParseProgress({ current: 0, total: 0, status: 'Reading Excel...' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const timetables = {};
        let totalBlocks = 0;
        let processedBlocks = 0;

        // First pass: count all blocks
        const allSheetBlocks = [];
        for (const sheetName of workbook.SheetNames) {
          if (isIgnoredSheet(sheetName)) continue;
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          const blockStarts = [];
          sheetData.forEach((row, idx) => {
            const rowStr = row.map(c => clean(c)).join(' ').toUpperCase();
            if (rowStr.includes('SHAHEED SUKHDEV') || rowStr.includes('CLASS TIME TABLE')) {
              if (blockStarts.length === 0 || idx - blockStarts[blockStarts.length - 1] > 15) {
                blockStarts.push(idx);
              }
            }
          });

          if (blockStarts.length > 0) {
            allSheetBlocks.push({ sheetName, sheetData, blockStarts });
            totalBlocks += blockStarts.length;
          }
        }

        setAiParseProgress({ current: 0, total: totalBlocks, status: `Found ${totalBlocks} timetable blocks...` });
        addLog(`[AI Parser] Found ${totalBlocks} timetable block(s) across ${allSheetBlocks.length} sheet(s).`, 'info');

        for (const { sheetName, sheetData, blockStarts } of allSheetBlocks) {
          for (let bIdx = 0; bIdx < blockStarts.length; bIdx++) {
            processedBlocks++;
            const startRow = blockStarts[bIdx];
            const nextStartRow = blockStarts[bIdx + 1] || sheetData.length;
            const blockRows = sheetData.slice(startRow, Math.min(nextStartRow, startRow + 40));

            setAiParseProgress({ current: processedBlocks, total: totalBlocks, status: `Parsing block ${processedBlocks}/${totalBlocks} from "${sheetName}"...` });

            let parsedOk = false;

            // Try Hugging Face AI parsing
            if (token) {
              try {
                // Convert block rows to structured text for the LLM
                let blockText = '';
                blockRows.forEach((r, idx) => {
                  const nonEmpty = r.map((c, colIdx) => {
                    if (c === null || c === undefined || String(c).trim() === '') return null;
                    return `[C${colIdx}]${String(c).trim()}`;
                  }).filter(Boolean);
                  if (nonEmpty.length > 0) blockText += `R${idx}: ${nonEmpty.join(' | ')}\n`;
                });

                const systemPrompt = `You are a precise timetable data extractor for Shaheed Sukhdev College of Business Studies (SSCBS, Delhi University). You will receive raw cell data from an Excel timetable block.

Extract and return a raw JSON object with EXACTLY this structure:
{
  "course": "BMS" or "BBA FIA" or "Bsc Comp Sci",
  "semester": "1" or "3" or "5" or "7" (string),
  "section": "A" or "B" or "C" or "D" (string),
  "room": "Room 703",
  "weekSchedule": {
    "Monday": [
      {"period": 1, "subject": "Subject Name", "teacher": "Dr. Full Name", "room": "Room 703"},
      {"period": 2, "subject": "...", "teacher": "...", "room": "..."},
      {"period": 3, "subject": "...", "teacher": "...", "room": "..."},
      {"period": 0, "isBreak": true, "subject": "Infinity Hour (Break)", "teacher": "", "room": ""},
      {"period": 4, "subject": "...", "teacher": "...", "room": "..."},
      {"period": 5, "subject": "...", "teacher": "...", "room": "..."},
      {"period": 6, "subject": "...", "teacher": "...", "room": "..."},
      {"period": 7, "subject": "...", "teacher": "...", "room": "..."}
    ],
    "Tuesday": [...same 8 entries...],
    "Wednesday": [...],
    "Thursday": [...],
    "Friday": [...]
  }
}

STRICT EXTRACTION RULES:
1. LEGEND TABLE MATCHING (MOST IMPORTANT):
   - At the bottom of each timetable block, there is a paper/faculty legend table mapping short teacher codes (e.g. "SP", "AM", "RRS", "TA", "MV", "SJ", "AyG", "DD") to paper names and full faculty names.
   - ALWAYS look up short codes in that block's legend table and return the full faculty name (e.g., "SP" -> "Dr. Shalini Prakash", "RRS" -> "Dr. Rishi Rajan Sahay", "AM" -> "Dr. Anuja Mathur" or "Dr. Amit Kumar" based on the legend).
   - Never guess or confuse teacher names; strictly rely on the legend table provided in the raw block.

2. CLEAN TEACHER NAMES:
   - Do NOT attach "(Tute)", "(P)", "(Practical)", "(Tutorial)", "(G1)", "(G2)", or room numbers to the teacher's name.
   - Example: If a cell says "SP (Tute)" or "SP (P)", teacher must be "Dr. Shalini Prakash". Put "(Tutorial)" or "(Practical)" in subject.

3. ROOM NUMBER EXTRACTION:
   - If a 3-digit number (e.g., 607, 648, 703, 361) or "(607/226)" appears inside the cell, place it cleanly in the "room" field as "Room 607" (or "Room 607 / Room 226"). Do not leave room numbers inside subject or teacher names.

4. ELECTIVES VS FACULTY:
   - Elective course names (e.g. "Hindi A", "Hindi B", "Hindi C", "Hindi D", "AECC", "VAC", "SEC", "GE") are subjects, NOT teachers. Put them in "subject". If no professor is specified for an elective slot, set "teacher" to "-".

5. SPLIT GROUP (G1 / G2) CLASSES:
   - If a cell has a split class for Group 1 and Group 2 (e.g., G1 taught by Dr. Anuja Mathur in 607, G2 taught by Dr. Rishi Rajan Sahay in 226):
     * subject: "G1: Subject1 | G2: Subject2" (or "Subject Name" if same)
     * teacher: "Dr. Anuja Mathur (G1) / Dr. Rishi Rajan Sahay (G2)"
     * room: "G1: Room 607 / G2: Room 226"

6. FORMAT & DAY STRUCTURE:
   - Each day (Monday to Friday) MUST have 8 period objects: period 1, 2, 3, 0 (isBreak), 4, 5, 6, 7.
   - Return ONLY the raw JSON object, no markdown code fences, no extra text.`;

                const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    model: 'Qwen/Qwen2.5-72B-Instruct',
                    messages: [
                      { role: 'system', content: systemPrompt },
                      { role: 'user', content: `Parse this timetable block:\n\n${blockText}` }
                    ],
                    max_tokens: 4096,
                    temperature: 0.1
                  })
                });

                if (res.ok) {
                  const data = await res.json();
                  let rawText = data.choices?.[0]?.message?.content || '';
                  
                  // Strip markdown code fences and thinking tags if present
                  rawText = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
                  rawText = rawText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
                  
                  // Find JSON object in the response
                  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    const aiResult = JSON.parse(jsonMatch[0]);
                    if (aiResult && aiResult.course && aiResult.weekSchedule) {
                      const course = aiResult.course;
                      const sem = String(aiResult.semester || '1');
                      const section = aiResult.section || 'A';
                      if (!timetables[course]) timetables[course] = {};
                      if (!timetables[course][sem]) timetables[course][sem] = {};
                      
                      timetables[course][sem][section] = aiResult.weekSchedule;
                      addLog(`  ✓ [AI Block ${processedBlocks}] ${course} Sem ${sem} Sec ${section}`, 'success');
                      parsedOk = true;
                    }
                  }
                } else {
                  const errText = await res.text();
                  addLog(`  ⚠️ [AI Block ${processedBlocks}] HF API error (${res.status}). Using fallback parser.`, 'warning');
                  console.warn('HF API error:', errText);
                }
              } catch (aiErr) {
                addLog(`  ⚠️ [AI Block ${processedBlocks}] AI parse error: ${aiErr.message}. Using fallback.`, 'warning');
              }
            }

            // Fallback to smart rule-based parser
            if (!parsedOk) {
              let defaultSem = '1';
              let defaultCourse = sheetName.toUpperCase().includes('BBA') ? 'BBA FIA' : sheetName.toUpperCase().includes('CS') || sheetName.toUpperCase().includes('CLASSWISE') ? 'Bsc Comp Sci' : 'BMS';
              const result = parseSheetBlock(sheetData, startRow, defaultCourse, defaultSem);
              if (result) {
                const { course, sem, section, weekSchedule } = result;
                if (!timetables[course]) timetables[course] = {};
                if (!timetables[course][sem]) timetables[course][sem] = {};
                timetables[course][sem][section] = weekSchedule;
                addLog(`  → [Fallback Block ${processedBlocks}] ${course} Sem ${sem} Sec ${section}`, 'info');
              }
            }

            // Small delay between API calls to respect rate limits
            if (token && bIdx < blockStarts.length - 1) {
              await new Promise(r => setTimeout(r, 500));
            }
          }
        }

        if (Object.keys(timetables).length > 0) {
          // Merge with existing parsed data (mgmt + cs)
          const mgmtData = {};
          const csData = {};
          for (const [courseName, sems] of Object.entries(timetables)) {
            if (courseName === 'Bsc Comp Sci') {
              csData[courseName] = sems;
            } else {
              mgmtData[courseName] = sems;
            }
          }
          if (Object.keys(mgmtData).length > 0) {
            setMgmtParsedData(prev => ({ ...(prev || {}), ...mgmtData }));
          }
          if (Object.keys(csData).length > 0) {
            setCsParsedData(prev => ({ ...(prev || {}), ...csData }));
          }

          const summary = Object.entries(timetables).map(([c, sems]) => 
            `${c}: Sems [${Object.keys(sems).sort().join(', ')}]`
          ).join(' | ');
          addLog(`[AI Parser] ✅ Successfully parsed! ${summary}`, 'success');
          setAiParseProgress({ current: totalBlocks, total: totalBlocks, status: 'Complete!' });
        } else {
          addLog(`[AI Parser] ⚠️ No timetable blocks recognized in file.`, 'warning');
          setAiParseProgress({ current: 0, total: 0, status: '' });
        }
      } catch (err) {
        addLog(`[AI Parser] ❌ Error: ${err.message}`, 'error');
        setAiParseProgress({ current: 0, total: 0, status: '' });
      } finally {
        setIsParsingMgmt(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
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

  // Manual editor handlers reading from draft
  const getCourses = () => {
    const data = draftTimetable || timetable || {};
    return Object.keys(data).filter(k => k !== '_meta' && typeof data[k] === 'object');
  };
  const getSemesters = () => {
    const data = draftTimetable || timetable || {};
    if (!data || !data[selectedCourse]) return [];
    return Object.keys(data[selectedCourse]);
  };
  const getSections = () => {
    const data = draftTimetable || timetable || {};
    if (!data || !data[selectedCourse] || !data[selectedCourse][selectedSem]) return [];
    return Object.keys(data[selectedCourse][selectedSem]);
  };

  const getActiveDayClasses = () => {
    const data = draftTimetable || timetable || {};
    if (!data || !data[selectedCourse] || !data[selectedCourse][selectedSem] || !data[selectedCourse][selectedSem][selectedSection]) {
      return [];
    }
    return data[selectedCourse][selectedSem][selectedSection][selectedDay] || [];
  };

  const handleEditClick = (idx, slot) => {
    setEditingSlotIdx(idx);
    setEditFields({
      subject: slot.subject,
      teacher: slot.teacher,
      room: slot.room
    });
  };

  const handleManualSave = () => {
    try {
      const data = draftTimetable || timetable || {};
      const updated = JSON.parse(JSON.stringify(data));
      if (!updated[selectedCourse]?.[selectedSem]?.[selectedSection]?.[selectedDay]) return;
      const dayClasses = updated[selectedCourse][selectedSem][selectedSection][selectedDay];
      dayClasses[editingSlotIdx] = {
        ...dayClasses[editingSlotIdx],
        subject: editFields.subject,
        teacher: editFields.teacher,
        room: editFields.room
      };
      setDraftTimetable(updated);
      setHasUnpublishedChanges(true);
      setEditingSlotIdx(null);
      setSaveStatus({ type: 'success', message: 'Slot updated in draft preview. Click "Publish Timetable to Live OS" to save changes live.' });
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to update slot in draft.' });
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
          <span className="admin-email">{user?.email}</span>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="admin-console-content">
        
        {/* Navigation Tabs */}
        <nav className="admin-tabs">
          <button 
            className={`admin-tab-btn ${activeTab === 'editor' || activeTab === 'uploader' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            Schedule & Timetable Manager
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
          <button 
            className={`admin-tab-btn ${activeTab === 'holidays' ? 'active' : ''}`}
            onClick={() => setActiveTab('holidays')}
          >
            Holidays & Fests
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            App Settings
          </button>
        </nav>

        {saveStatus.message && (
          <div className={`admin-status-banner ${saveStatus.type}`}>
            {saveStatus.type === 'success' ? '✓ ' : '⚠️ '}
            {saveStatus.message}
          </div>
        )}

        {/* Tab contents */}
        {activeTab === 'editor' || activeTab === 'uploader' ? (
          <div className="tab-pane schedules-manager-pane">
            
            {/* Top Bar for Draft Status & Publish Action */}
            <div className="schedule-publish-bar">
              <div className="publish-bar-info">
                <span className="publish-status-icon">{hasUnpublishedChanges ? '🟡' : '🟢'}</span>
                <div>
                  <h3 className="publish-status-title">
                    {hasUnpublishedChanges ? 'Unpublished Schedule Draft Active' : 'Live Schedule Active'}
                  </h3>
                  <p className="publish-status-sub">
                    {hasUnpublishedChanges
                      ? 'Schedule changes from AI Uploader or Live Editor are loaded in draft. Click "Publish Timetable to Live OS" to send to student dashboards.'
                      : 'Current timetable in database is live and active on all student dashboards.'}
                  </p>
                </div>
              </div>
              <div className="publish-bar-actions">
                {hasUnpublishedChanges && (
                  <button className="btn-discard-draft" onClick={handleDiscardDraftChanges} disabled={isSaving}>
                    ↺ Discard Draft
                  </button>
                )}
                <button 
                  className={`btn-publish-all-master ${hasUnpublishedChanges ? 'has-changes' : ''}`}
                  onClick={handlePublishDraftTimetable} 
                  disabled={isSaving}
                >
                  {isSaving ? '⏳ Publishing Live...' : '🚀 Publish Timetable to Live OS'}
                </button>
              </div>
            </div>

            {/* AI Schedule Uploader Card */}
            <div className="schedule-section-card uploader-card-wrapper">
              <div className="schedule-section-header">
                <span className="section-header-icon">📥</span>
                <div>
                  <h3>AI Schedule Uploader</h3>
                  <p>Paste structured AI output text below. Text is automatically parsed and loaded directly into the Live Schedule Editor draft below.</p>
                </div>
              </div>

              {/* Prompt Section */}
              <div className="uploader-prompt-section">
                <div className="prompt-header-row">
                  <div>
                    <h3>📋 AI Timetable Prompt</h3>
                    <p className="section-desc-small">Copy this prompt, paste it into Claude or ChatGPT with the Excel timetable file, and paste the output back here.</p>
                  </div>
                  <div className="prompt-actions">
                    <button className={`btn-copy-prompt ${promptCopied ? 'copied' : ''}`} onClick={handleCopyPrompt}>
                      {promptCopied ? '✓ Copied!' : '📋 Copy Prompt to Clipboard'}
                    </button>
                    <button className="btn-toggle-prompt" onClick={() => setShowPromptExpanded(!showPromptExpanded)}>
                      {showPromptExpanded ? '▲ Collapse' : '▼ Preview Prompt'}
                    </button>
                  </div>
                </div>
                {showPromptExpanded && (
                  <pre className="prompt-preview-box">{TIMETABLE_AI_PROMPT}</pre>
                )}
              </div>

              {/* Two Column Upload Cards */}
              <div className="uploader-columns">
                {/* Management Column */}
                <div className="uploader-card">
                  <div className="uploader-card-header mgmt">
                    <span className="uploader-card-icon">🏢</span>
                    <div>
                      <h4>Management (BMS + BBA FIA)</h4>
                      <p>Paste the AI-generated text for Management timetables</p>
                    </div>
                  </div>
                  <textarea
                    className="text-parser-textarea"
                    placeholder={`Paste the Claude/ChatGPT output here...\n\nExpected format:\n=== BMS | Semester 1 | Section A | Room 703 ===\nMonday:\n  P1: Subject | Teacher | Room\n  P2: ...`}
                    value={textInputMgmt}
                    onChange={(e) => { setTextInputMgmt(e.target.value); setTextParsedMgmt(null); }}
                    rows={8}
                  />
                  <div className="uploader-card-actions">
                    <button
                      className="btn-parse-text"
                      onClick={() => parseTextWithHuggingFace(textInputMgmt, 'mgmt')}
                      disabled={!textInputMgmt.trim() || isParsingTextMgmt}
                    >
                      {isParsingTextMgmt ? '⏳ Parsing & Loading...' : '🔍 Parse Text & Auto-Populate'}
                    </button>
                    {textInputMgmt && (
                      <button className="btn-clear-text" onClick={() => { setTextInputMgmt(''); setTextParsedMgmt(null); }}>
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Parse Preview Summary */}
                  {textParsedMgmt && (
                    <div className="parse-preview">
                      <h5>✅ Loaded into Live Editor Draft below</h5>
                      <div className="parse-preview-list">
                        {getTextParseSummary(textParsedMgmt).map((item, i) => (
                          <div key={i} className="parse-preview-item">
                            <span className="preview-badge">{item.course}</span>
                            <span>Sem {item.sem}</span>
                            <span className="preview-sections">Sections: {item.sections}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="uploader-card-scrap">
                    <button className="btn-scrap-timetable" onClick={handleScrapMgmtTimetable} disabled={isSaving}>
                      🗑️ Scrap Management Draft
                    </button>
                  </div>
                </div>

                {/* B.Sc. CS Column */}
                <div className="uploader-card">
                  <div className="uploader-card-header cs">
                    <span className="uploader-card-icon">💻</span>
                    <div>
                      <h4>B.Sc. Computer Science</h4>
                      <p>Paste the AI-generated text for B.Sc. CS timetables</p>
                    </div>
                  </div>
                  <textarea
                    className="text-parser-textarea"
                    placeholder={`Paste the Claude/ChatGPT output here...\n\nExpected format:\n=== Bsc Comp Sci | Semester 1 | Section A | Room 403 ===\nMonday:\n  P1: Subject | Teacher | Room\n  P2: ...`}
                    value={textInputCs}
                    onChange={(e) => { setTextInputCs(e.target.value); setTextParsedCs(null); }}
                    rows={8}
                  />
                  <div className="uploader-card-actions">
                    <button
                      className="btn-parse-text"
                      onClick={() => parseTextWithHuggingFace(textInputCs, 'cs')}
                      disabled={!textInputCs.trim() || isParsingTextCs}
                    >
                      {isParsingTextCs ? '⏳ Parsing & Loading...' : '🔍 Parse Text & Auto-Populate'}
                    </button>
                    {textInputCs && (
                      <button className="btn-clear-text" onClick={() => { setTextInputCs(''); setTextParsedCs(null); }}>
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Parse Preview Summary */}
                  {textParsedCs && (
                    <div className="parse-preview">
                      <h5>✅ Loaded into Live Editor Draft below</h5>
                      <div className="parse-preview-list">
                        {getTextParseSummary(textParsedCs).map((item, i) => (
                          <div key={i} className="parse-preview-item">
                            <span className="preview-badge cs">{item.course}</span>
                            <span>Sem {item.sem}</span>
                            <span className="preview-sections">Sections: {item.sections}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="uploader-card-scrap">
                    <button className="btn-scrap-timetable" onClick={handleScrapCsTimetable} disabled={isSaving}>
                      🗑️ Scrap B.Sc. CS Draft
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrap All + HF Key */}
              <div className="uploader-bottom-row">
                <button className="btn-scrap-all" onClick={handleScrapActiveTimetables} disabled={isSaving}>
                  🗑️ Clear ALL Timetables from Draft
                </button>
                <div className="hf-key-section">
                  {showHfKeyInput ? (
                    <div className="hf-key-input-row">
                      <input
                        type="password"
                        className="admin-input-field"
                        placeholder="Paste your Hugging Face API token..."
                        value={hfApiKey}
                        onChange={(e) => setHfApiKey(e.target.value)}
                      />
                      <button className="btn-clear-text" onClick={() => setShowHfKeyInput(false)}>Done</button>
                    </div>
                  ) : (
                    <button className="btn-configure-hf" onClick={() => setShowHfKeyInput(true)}>
                      ⚙️ {hfApiKey ? 'HF Token Set ✓' : 'Configure HF Token (Optional)'}
                    </button>
                  )}
                </div>
              </div>

              {/* Parsing Logs */}
              {textParserLogs.length > 0 && (
                <div className="text-parser-logs">
                  <div className="logs-header">
                    <h4>📜 Parsing Log</h4>
                    <button className="btn-clear-text" onClick={() => setTextParserLogs([])}>Clear</button>
                  </div>
                  <div className="logs-list">
                    {textParserLogs.map((log, i) => (
                      <div key={i} className={`log-entry log-${log.type}`}>
                        <span className="log-time">[{log.time}]</span> {log.msg}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Live Schedule Editor & Interactive Preview Section */}
            <div className="schedule-section-card editor-card-wrapper">
              <div className="schedule-section-header">
                <span className="section-header-icon">✏️</span>
                <div>
                  <h3>Live Schedule Editor & Interactive Preview</h3>
                  <p>Filter by Course, Semester, Section, and Day to inspect automatically populated slots or edit individual class periods.</p>
                </div>
              </div>

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
                    {getActiveDayClasses().length === 0 ? (
                      <tr>
                        <td colSpan="5" className="empty-schedule-td" style={{ textAlign: 'center', padding: '32px', color: 'var(--ink-dim)' }}>
                          No classes found for {selectedCourse} Sem {selectedSem} Section {selectedSection} on {selectedDay}. Paste schedule text in the uploader above to parse & populate automatically.
                        </td>
                      </tr>
                    ) : (
                      getActiveDayClasses().map((slot, idx) => {
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
                                  <button className="btn-action-save" onClick={handleManualSave}>Save Slot</button>
                                  <button className="btn-action-cancel" onClick={() => setEditingSlotIdx(null)}>Cancel</button>
                                </div>
                              ) : (
                                <button className="btn-action-edit" onClick={() => handleEditClick(idx, slot)}>Edit Slot</button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : activeTab === 'notices' ? (
          <div className="tab-pane notices-pane">
            <div className="pane-left notice-creator-card">
              <h3>{editingNoticeId ? 'Edit Campus Notice' : 'Publish New Notice'}</h3>
              <p className="subtitle-admin">
                {editingNoticeId 
                  ? 'Modify details, location, event schedule, or expiry date of this notice.' 
                  : 'Create announcements for events, society updates, guest lectures, and other college activities.'}
              </p>
              
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
                    <label htmlFor="notice-society">Organising Society (Optional)</label>
                    <input
                      type="text"
                      id="notice-society"
                      placeholder="e.g. Kronos"
                      value={noticeForm.society}
                      onChange={(e) => setNoticeForm(prev => ({ ...prev, society: e.target.value }))}
                      className="admin-input-field"
                    />
                  </div>
                  
                  <div className="form-item-admin flex-1">
                    <label htmlFor="notice-venue">Venue / Location (Optional)</label>
                    <input
                      type="text"
                      id="notice-venue"
                      placeholder="e.g. Auditorium / Room 408 / Online"
                      value={noticeForm.venue}
                      onChange={(e) => setNoticeForm(prev => ({ ...prev, venue: e.target.value }))}
                      className="admin-input-field"
                    />
                  </div>
                </div>

                <div className="form-item-admin">
                  <label htmlFor="notice-content">Notice Description (Optional)</label>
                  <textarea
                    id="notice-content"
                    rows="4"
                    placeholder="Describe the notice or event details in full..."
                    value={noticeForm.content}
                    onChange={(e) => setNoticeForm(prev => ({ ...prev, content: e.target.value }))}
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

                <div className="notice-form-buttons">
                  <button 
                    type="submit" 
                    className="btn-publish-timetable" 
                    disabled={isSaving}
                    style={{ marginTop: '0.5rem' }}
                  >
                    {isSaving ? (editingNoticeId ? 'Updating Notice...' : 'Publishing Notice...') : (editingNoticeId ? 'Save Changes' : 'Publish Campus Notice')}
                  </button>
                  {editingNoticeId && (
                    <button
                      type="button"
                      className="btn-cancel-edit"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      style={{ marginTop: '0.5rem' }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="pane-right notices-list-card">
              {/* Sub-tabs Navigation */}
              <div className="notice-subtabs-bar">
                <button
                  className={`notice-subtab-btn ${noticeSubTab === 'live' ? 'active' : ''}`}
                  onClick={() => setNoticeSubTab('live')}
                >
                  🟢 Live Board ({noticesList.length})
                </button>
                <button
                  className={`notice-subtab-btn ${noticeSubTab === 'pending' ? 'active' : ''}`}
                  onClick={() => setNoticeSubTab('pending')}
                >
                  ⏳ Pending Drafts ({pendingNoticeDrafts.length})
                </button>
                <button
                  className={`notice-subtab-btn ${noticeSubTab === 'requests' ? 'active' : ''}`}
                  onClick={() => setNoticeSubTab('requests')}
                >
                  🙋 Access Requests ({drafterAccessRequests.length})
                </button>
                <button
                  className={`notice-subtab-btn ${noticeSubTab === 'roster' ? 'active' : ''}`}
                  onClick={() => setNoticeSubTab('roster')}
                >
                  🛡️ Drafters Roster ({approvedDrafters.length})
                </button>
              </div>

              <div className="notices-manager-list">
                {loadingNotices ? (
                  <div className="notices-manager-loading">
                    <span className="console-spinner"></span>
                    <p>Loading Campus Buzz management data...</p>
                  </div>
                ) : noticeSubTab === 'live' ? (
                  /* LIVE NOTICES & REORDERING VIEW */
                  noticesList.length === 0 ? (
                    <div className="no-logs">No live notices found. Publish one to get started!</div>
                  ) : (
                    <div className="admin-notices-grid">
                      {noticesList.map((notice, index) => {
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
                              {notice.society && <span className="notice-item-society">@{notice.society}</span>}
                              <span className={`admin-status-badge ${status.class}`}>{status.label}</span>
                            </div>
                            <h4 className="notice-item-title">{notice.title}</h4>
                            {notice.content && (
                              <p className="notice-item-desc">{notice.content.substring(0, 80)}{notice.content.length > 80 ? '...' : ''}</p>
                            )}
                            
                            {(notice.event_date || notice.venue || notice.active_from || notice.active_to) && (
                              <div className="notice-item-schedule-info">
                                {notice.event_date && <div style={{ color: '#000000', fontWeight: 'bold' }}>📅 Event: {new Date(notice.event_date).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'})}</div>}
                                {notice.venue && <div style={{ color: '#000000' }}>📍 Venue: {notice.venue}</div>}
                                {notice.active_from && <div>🟢 Start: {new Date(notice.active_from).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'})}</div>}
                                {notice.active_to && <div>🔴 Expire: {new Date(notice.active_to).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'})}</div>}
                              </div>
                            )}

                            <div className="notice-item-actions">
                              <div className="notice-reorder-buttons">
                                <button
                                  type="button"
                                  className="btn-reorder-notice"
                                  title="Move Up"
                                  disabled={index === 0 || isSaving}
                                  onClick={() => handleReorderNotices(index, 'up')}
                                >
                                  ⬆️
                                </button>
                                <button
                                  type="button"
                                  className="btn-reorder-notice"
                                  title="Move Down"
                                  disabled={index === noticesList.length - 1 || isSaving}
                                  onClick={() => handleReorderNotices(index, 'down')}
                                >
                                  ⬇️
                                </button>
                              </div>
                              <span className="notice-item-date">{new Date(notice.created_at).toLocaleDateString()}</span>
                              <div className="notice-action-buttons">
                                <button
                                  type="button"
                                  className="btn-edit-notice"
                                  onClick={() => handleEditNoticeClick(notice)}
                                  disabled={isSaving}
                                >
                                  ✏️ Edit
                                </button>
                                <button 
                                  type="button"
                                  className="btn-delete-notice"
                                  onClick={() => handleDeleteNotice(notice.id)}
                                  disabled={isSaving}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : noticeSubTab === 'pending' ? (
                  /* PENDING DRAFT SUBMISSIONS VIEW */
                  pendingNoticeDrafts.length === 0 ? (
                    <div className="no-logs">🎉 No pending notice drafts waiting for review.</div>
                  ) : (
                    <div className="admin-notices-grid">
                      {pendingNoticeDrafts.map((draft) => (
                        <div key={draft.id} className="admin-notice-item pending-card">
                          <div className="author-banner">
                            <span className="author-email">✉️ {draft.created_by_email || 'Student Submission'}</span>
                            {draft.created_by_name && <span className="author-name">({draft.created_by_name})</span>}
                          </div>
                          <div className="notice-item-meta">
                            {draft.society ? <span className="notice-item-society">@{draft.society}</span> : <span className="notice-item-society">No Society Specified</span>}
                            <span className="admin-status-badge status-scheduled">Pending Review</span>
                          </div>
                          <h4 className="notice-item-title">{draft.title}</h4>
                          <p className="notice-item-desc">{draft.content}</p>
                          
                          {(draft.event_date || draft.venue || draft.link_url) && (
                            <div className="notice-item-schedule-info">
                              {draft.event_date && <div>📅 Event: {new Date(draft.event_date).toLocaleString()}</div>}
                              {draft.venue && <div>📍 Venue: {draft.venue}</div>}
                              {draft.link_url && <div>🔗 Link: <a href={draft.link_url} target="_blank" rel="noreferrer">{draft.link_url}</a></div>}
                            </div>
                          )}

                          <div className="moderation-action-bar">
                            <button
                              type="button"
                              className="btn-moderate-edit"
                              onClick={() => handleEditNoticeClick(draft)}
                            >
                              ✏️ Edit Draft
                            </button>
                            <button
                              type="button"
                              className="btn-moderate-approve"
                              onClick={() => handleAcceptNoticeDraft(draft.id)}
                            >
                              ✅ Accept & Publish
                            </button>
                            <button
                              type="button"
                              className="btn-moderate-refuse"
                              onClick={() => handleRefuseNoticeDraft(draft.id)}
                            >
                              ❌ Refuse
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : noticeSubTab === 'requests' ? (
                  /* ACCESS REQUESTS VIEW */
                  drafterAccessRequests.length === 0 ? (
                    <div className="no-logs">No pending drafter access requests from students.</div>
                  ) : (
                    <div className="requests-grid">
                      {drafterAccessRequests.map((req) => (
                        <div key={req.id} className="request-admin-card">
                          <div className="request-card-info">
                            <div className="request-user-email">✉️ {req.user_email}</div>
                            {req.full_name && <div className="request-user-name">Applicant: {req.full_name}</div>}
                            <div className="request-society-note">
                              <strong>Note / Role:</strong> "{req.society_note}"
                            </div>
                            <div className="request-date">Requested: {new Date(req.created_at).toLocaleString()}</div>
                          </div>
                          <div className="request-card-actions">
                            <button
                              type="button"
                              className="btn-grant-access"
                              onClick={() => handleGrantDrafterAccess(req.id)}
                            >
                              ✅ Grant Access
                            </button>
                            <button
                              type="button"
                              className="btn-decline-access"
                              onClick={() => handleDeclineDrafterAccess(req.id)}
                            >
                              ❌ Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  /* APPROVED DRAFTERS ROSTER VIEW */
                  approvedDrafters.length === 0 ? (
                    <div className="no-logs">No approved notice drafters on roster yet.</div>
                  ) : (
                    <div className="roster-grid">
                      {approvedDrafters.map((drafter) => (
                        <div key={drafter.id} className="roster-admin-card">
                          <div className="roster-card-info">
                            <div className="roster-email">🛡️ {drafter.user_email}</div>
                            {drafter.full_name && <div className="roster-name">{drafter.full_name}</div>}
                            <div className="roster-role">"{drafter.society_note}"</div>
                            <div className="roster-date">Approved: {new Date(drafter.updated_at || drafter.created_at).toLocaleDateString()}</div>
                          </div>
                          <button
                            type="button"
                            className="btn-revoke-access"
                            onClick={() => handleRevokeDrafterAccess(drafter.id)}
                          >
                            🚫 Revoke Access
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'analytics' ? (
          /* Student Demographics Analytics Tab */
          <div className="tab-pane analytics-pane">
            <div className="analytics-stats-grid">
              <div className="stat-card-admin highlight-online">
                <div className="card-icon">🟢</div>
                <h4>Online Right Now</h4>
                <p className="stat-number">{onlinePresence.length}</p>
                <p className="stat-subtitle">Students active on OS shell</p>
              </div>
              <div className="stat-card-admin">
                <div className="card-icon">👥</div>
                <h4>Total Students</h4>
                <p className="stat-number">
                  {analyticsUsers.filter(u => ['BMS', 'BBA FIA', 'Bsc Comp Sci'].includes(u.course)).length}
                </p>
                <p className="stat-subtitle">Verified student profiles</p>
              </div>
              <div className="stat-card-admin">
                <div className="card-icon">🏆</div>
                <h4>Top Feature</h4>
                <p className="stat-number text-truncate" style={{ fontSize: '1.25rem' }}>
                  {analyticsSummary.topFeatureName}
                </p>
                <p className="stat-subtitle">{analyticsSummary.topFeatureCount} visits</p>
              </div>
              <div className="stat-card-admin">
                <div className="card-icon">📊</div>
                <h4>Total Page Visits</h4>
                <p className="stat-number">{analyticsSummary.totals?.grandTotal || 0}</p>
                <p className="stat-subtitle">Visits in window</p>
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
                  {onlinePresence.length} Active Now • Real-Time 1s
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
                      {[...onlinePresence]
                        .sort((a, b) => (b.lastPing || 0) - (a.lastPing || 0))
                        .map((usr) => {
                          const pingDiffSec = Math.max(0, Math.floor((tickerNow - (usr.lastPing || tickerNow)) / 1000));
                          const featKey = usr.currentView || 'home';
                          const featStyleMap = {
                            home: { bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
                            timetable: { bg: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' },
                            'find-prof': { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
                            waiver: { bg: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4', border: 'rgba(6, 182, 212, 0.3)' },
                            gpa: { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
                            buzz: { bg: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', border: 'rgba(236, 72, 153, 0.3)' },
                            profile: { bg: 'rgba(20, 184, 166, 0.12)', color: '#14b8a6', border: 'rgba(20, 184, 166, 0.3)' },
                            admin: { bg: 'rgba(234, 179, 8, 0.12)', color: '#eab308', border: 'rgba(234, 179, 8, 0.3)' }
                          };
                          const chipStyle = featStyleMap[featKey] || featStyleMap.home;

                          return (
                            <tr key={usr.session_id || usr.id || usr.email}>
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
                  <h3>📈 Feature Visit Analytics (Time-Series)</h3>
                  <p className="section-desc-small">
                    {analyticsTimeRange === 1 
                      ? 'Hourly visit trends across student OS tools over the last 24 hours. Toggle student features below to inspect page metrics.' 
                      : 'Daily visit trends across student OS tools over time. Toggle student features below to inspect page metrics.'}
                  </p>
                </div>
                
                <div className="graph-time-selectors">
                  {[
                    { days: 1, label: 'Last 24 Hours' },
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
              <div className="graph-legend-toggles" style={{ marginTop: '14px' }}>
                {(() => {
                  const activeTotals = analyticsSummary.totals || {};

                  const legendItems = [
                    { key: 'timetable', label: 'Timetable', color: '#8b5cf6' },
                    { key: 'find-prof', label: 'Find My Professor', color: '#10b981' },
                    { key: 'team-finder', label: 'Team Finder & Compete Hub', color: '#f43f5e' },
                    { key: 'waiver', label: 'Waiver Tool', color: '#06b6d4' },
                    { key: 'gpa', label: 'GPA Calculator', color: '#f59e0b' },
                    { key: 'buzz', label: 'Campus Buzz', color: '#ec4899' },
                    { key: 'profile', label: 'Profile Page', color: '#14b8a6' }
                  ];

                  return legendItems.map(({ key, label, color }) => {
                    const count = activeTotals[key] ?? 0;
                    return (
                      <button
                        key={key}
                        className={`legend-toggle-item ${enabledSeries[key] ? 'active' : 'disabled'}`}
                        onClick={() => toggleSeries(key)}
                      >
                        <span className="legend-dot" style={{ backgroundColor: color }}></span>
                        <span className="legend-name">{label}</span>
                        <span className="legend-count">({count} visits)</span>
                      </button>
                    );
                  });
                })()}
              </div>

              {/* SVG Line Graph Render */}
              <div className="line-graph-wrapper">
                {(() => {
                  const series = analyticsSummary.series || {};
                  const dateLabels = analyticsSummary.dateLabels || [];
                  const fullLabels = analyticsSummary.fullLabels || dateLabels;
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
                    timetable: '#8b5cf6',
                    'find-prof': '#10b981',
                    'team-finder': '#f43f5e',
                    waiver: '#06b6d4',
                    gpa: '#f59e0b',
                    buzz: '#ec4899',
                    profile: '#14b8a6'
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
                          if (!enabledSeries[seriesKey] || seriesKey === 'admin' || seriesKey.startsWith('total')) return null;
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
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity={0.85}
                              />
                              {points.map((val, idx) => (
                                <circle
                                  key={idx}
                                  cx={getX(idx)}
                                  cy={getY(val)}
                                  r="3.5"
                                  fill={color}
                                  stroke="var(--surface)"
                                  strokeWidth="1.5"
                                  className="graph-point-circle"
                                  onMouseEnter={() => setHoveredPoint({ date: fullLabels[idx] || dateLabels[idx], seriesKey, val, x: getX(idx), y: getY(val) })}
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
                            <strong>{FEATURE_NAMES[hoveredPoint.seriesKey] || hoveredPoint.seriesKey.toUpperCase()}</strong>: {hoveredPoint.val} visits
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Detailed Tool Analytics Breakdown Table */}
              <div className="feature-breakdown-card" style={{ marginTop: '20px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 800, color: 'var(--ink)' }}>
                  📊 Detailed Tool Breakdown (Page & Function Visits)
                </h4>
                <div className="table-responsive-admin">
                  <table className="registry-table-admin feature-breakdown-table">
                    <thead>
                      <tr>
                        <th>Feature / Tool</th>
                        <th>👁️ Page & Function Visits</th>
                        <th>Share %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const vTotals = analyticsSummary.totals || {};
                        const grandTotal = Object.keys(vTotals)
                          .filter(k => k !== 'total' && k !== 'admin' && k !== 'grandTotal')
                          .reduce((acc, k) => acc + (vTotals[k] || 0), 0) || 1;

                        const toolsList = [
                          { id: 'timetable', name: 'Timetable' },
                          { id: 'find-prof', name: 'Find My Professor' },
                          { id: 'team-finder', name: 'Team Finder & Compete Hub' },
                          { id: 'waiver', name: 'Waiver Tool' },
                          { id: 'gpa', name: 'GPA Calculator' },
                          { id: 'buzz', name: 'Campus Buzz' },
                          { id: 'profile', name: 'Profile Page' }
                        ];

                        return toolsList.map(({ id, name }) => {
                          const visits = vTotals[id] || 0;
                          const sharePct = grandTotal > 0 ? Math.round((visits / grandTotal) * 100) : 0;

                          return (
                            <tr key={id}>
                              <td><strong style={{ color: 'var(--ink)' }}>{name}</strong></td>
                              <td><span className="metric-badge-visit">{visits} visits</span></td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${sharePct}%`, background: 'var(--accent)', borderRadius: '3px' }}></div>
                                  </div>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--ink-dim)' }}>{sharePct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
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
                  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];
                  const yearLabels = ['1st Year', '1st Year', '2nd Year', '2nd Year', '3rd Year', '3rd Year', '4th Year', '4th Year'];
                  const counts = semesters.map(s => analyticsUsers.filter(u => u.semester === String(s)).length);
                  const maxVal = Math.max(...counts, 1);

                  return (
                    <div className="bar-chart-wrapper">
                      {semesters.map((sem, i) => {
                        const pct = (counts[i] / maxVal) * 100;
                        return (
                          <div className="bar-item-admin" key={sem}>
                            <div className="bar-item-label-row">
                              <span>Semester {sem} ({yearLabels[i]})</span>
                              <span>{counts[i]} Students</span>
                            </div>
                            <div className="bar-track-admin">
                              <div className="bar-fill-admin" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #8b5cf6, #c084fc)' }} />
                            </div>
                          </div>
                        );
                      })}
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
                const filtered = analyticsUsers
                  .filter(u => {
                    const matchSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                        u.email.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchCourse = filterCourse === 'All' || u.course === filterCourse;
                    const matchSem = filterSem === 'All' || u.semester === filterSem;
                    return matchSearch && matchCourse && matchSem;
                  })
                  .sort((a, b) => (b.lastActiveMs || 0) - (a.lastActiveMs || 0));

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
        ) : activeTab === 'holidays' ? (
          <div className="tab-pane holidays-pane flex-row gap-4">
            <div className="pane-left notice-creator-card" style={{ flex: '1' }}>
              <div className="chart-header-admin">
                <h3>Add New Blocked Date</h3>
                <p className="section-desc-small">Mark a day as a Holiday, Fest, or Off-day. The student portal will show this message instead of their class schedule.</p>
              </div>
              
              <form onSubmit={handleAddHoliday} className="admin-form">
                <div className="form-item-admin">
                  <label>Date</label>
                  <input
                    type="date"
                    required
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm(prev => ({ ...prev, date: e.target.value }))}
                    className="admin-input-field"
                  />
                </div>
                
                <div className="form-row-admin">
                  <div className="form-item-admin flex-1">
                    <label>Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Diwali / Crescendo Fest"
                      value={holidayForm.title}
                      onChange={(e) => setHolidayForm(prev => ({ ...prev, title: e.target.value }))}
                      className="admin-input-field"
                    />
                  </div>
                  <div className="form-item-admin flex-1">
                    <label>Type</label>
                    <select
                      value={holidayForm.type}
                      onChange={(e) => setHolidayForm(prev => ({ ...prev, type: e.target.value }))}
                      className="admin-select-field"
                    >
                      <option value="Holiday">Holiday</option>
                      <option value="Fest">Fest</option>
                      <option value="Event">Event</option>
                      <option value="Off-Day">Off-Day</option>
                    </select>
                  </div>
                </div>

                <div className="form-item-admin">
                  <label>Custom Message (Shown to students)</label>
                  <textarea
                    rows="3"
                    placeholder="e.g. No classes today due to the annual college fest. Enjoy!"
                    value={holidayForm.message}
                    onChange={(e) => setHolidayForm(prev => ({ ...prev, message: e.target.value }))}
                    className="admin-textarea-field"
                  />
                </div>

                <div className="notice-form-buttons">
                  <button type="submit" className="btn-publish-timetable" disabled={isSavingHoliday}>
                    {isSavingHoliday ? 'Saving...' : 'Add Blocked Date'}
                  </button>
                </div>
              </form>
            </div>
            
            <div className="pane-right notices-list-card" style={{ flex: '1.5' }}>
              <h3>Blocked Dates List</h3>
              <div className="notices-manager-list">
                {(!holidays || holidays.length === 0) ? (
                  <div className="no-logs">No blocked dates found.</div>
                ) : (
                  <div className="admin-notices-grid">
                    {holidays.map(holiday => (
                      <div key={holiday.id} className="admin-notice-item">
                        <div className="notice-item-meta">
                          <span className="admin-status-badge status-active">{holiday.type}</span>
                        </div>
                        <h4 className="notice-item-title">{holiday.title}</h4>
                        {holiday.message && <p className="notice-item-desc">{holiday.message}</p>}
                        <div className="notice-item-schedule-info">
                          <div style={{ color: '#000000', fontWeight: 'bold' }}>📅 {new Date(holiday.date).toDateString()}</div>
                        </div>
                        <div className="notice-item-actions" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
                          <button 
                            className="btn-delete-notice"
                            onClick={() => handleDeleteHoliday(holiday.id)}
                            disabled={isSavingHoliday}
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
        ) : activeTab === 'settings' ? (
          <div className="tab-pane flex-col gap-4">
            <div className="chart-header-admin">
              <h3>App Section Toggles</h3>
              <p className="section-desc-small">Enable or disable various tools and sections of the SSCBS OS portal. Disabled tools will appear locked for students.</p>
            </div>
            
            <div className="admin-form" style={{ maxWidth: '600px' }}>
              {[
                { id: 'timetable', label: 'Timetable & Class Schedules', desc: 'Display timetable on home page and navigation' },
                { id: 'find-prof', label: 'Find My Professor', desc: 'Allow students to search for professor locations' },
                { id: 'team-finder', label: 'Team Finder & Competition Hub', desc: 'Allow students to post and find competition team openings' },
                { id: 'waiver', label: 'Waiver Tool', desc: 'Interactive attendance clearance tool' },
                { id: 'gpa', label: 'GPA Calculator', desc: 'Official DU schema calculator' },
                { id: 'pyqs', label: 'PYQs & Resources', desc: 'Access to previous year questions' },
                { id: 'buzz', label: 'Campus Buzz', notice: 'Notice board and announcements' }
              ].map(feature => (
                <div key={feature.id} className="form-item-admin" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--ink)' }}>{feature.label}</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--ink-dim)' }}>{feature.desc || feature.notice}</p>
                  </div>
                  <label className="admin-switch">
                    <input 
                      type="checkbox" 
                      checked={featureFlags[feature.id] ?? false}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        try {
                          await updateFeatureFlags({ [feature.id]: checked });
                          setSaveStatus({ type: 'success', message: `Feature '${feature.label}' ${checked ? 'enabled' : 'disabled'}!` });
                        } catch(err) {
                          setSaveStatus({ type: 'error', message: 'Failed to update feature flag' });
                        }
                      }}
                    />
                    <span className="admin-slider"></span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default function AdminConsolePage({ onBack }) {
  const { user } = useAuth();
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

  return <AdminConsoleContent onBack={onBack} />;
}

