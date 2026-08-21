import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useTimetable } from '../context/TimetableContext';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { isAdminEmail } from '../lib/admin';
import { subscribeToPresence, fetchAnalyticsData, FEATURE_NAMES } from '../lib/analytics';
import { DEMO_SOCIETIES, CATEGORIES } from '../data/societies';
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
  const [noticeMobileSection, setNoticeMobileSection] = useState('list'); // 'list' | 'form'
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
    setNoticeMobileSection('form');
    const element = document.querySelector('.notice-creator-card');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCancelEdit = () => {
    setEditingNoticeId(null);
    setNoticeForm({ title: '', category: 'General', society: '', venue: '', content: '', link_url: '', event_date: '', active_from: '', active_to: '' });
    setNoticeMobileSection('list');
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
        .select('id, title, category, society, venue, content, link_url, event_date, active_from, active_to, created_at, created_by_email, created_by_name, display_order, status')
        .order('display_order', { ascending: true })
        .order('event_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

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

          const timeA = a.event_date ? new Date(a.event_date).getTime() : (a.active_from ? new Date(a.active_from).getTime() : Infinity);
          const timeB = b.event_date ? new Date(b.event_date).getTime() : (b.active_from ? new Date(b.active_from).getTime() : Infinity);

          if (timeA !== timeB) return timeA - timeB;

          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
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
        .select('id, user_id, user_email, full_name, society_note, status, created_at, updated_at')
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

    // 2. Persist display_order updates to Supabase
    if (hasValidCredentials) {
      try {
        const updatePromises = updatedList
          .filter(item => item.id && !String(item.id).startsWith('mock-'))
          .map(item =>
            supabase
              .from('notices')
              .update({ display_order: item.display_order })
              .eq('id', item.id)
          );

        const results = await Promise.all(updatePromises);
        const hasError = results.some(res => res.error);
        if (hasError) {
          console.error('One or more notice display order updates failed in Supabase');
        }
      } catch (err) {
        console.error('Failed to update notice display order in Supabase:', err);
      }
    }

    // 3. Clear local cache & broadcast update event for live notice board sync
    try {
      sessionStorage.removeItem('sscbs_cached_notices');
      sessionStorage.removeItem('sscbs_cached_notices_time');
      window.dispatchEvent(new CustomEvent('sscbs-notices-updated', { detail: updatedList }));
    } catch (e) {}
  };


  React.useEffect(() => {
    if (activeTab === 'notices') {
      fetchAdminNotices();
      fetchDrafterRequestsAndRoster();
    } else if (activeTab === 'analytics' || activeTab === 'societies') {
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
        const hasCustomOrder = noticesList.some(n => (n.display_order ?? 0) !== 0);
        let newDisplayOrder = 0;
        if (hasCustomOrder) {
          const maxOrder = Math.max(...noticesList.map(n => n.display_order ?? 0));
          newDisplayOrder = maxOrder + 1;
        }

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
          setNoticesList(prev => {
            const list = [...prev, newMockNotice];
            return list.sort((a, b) => {
              const orderA = a.display_order ?? 0;
              const orderB = b.display_order ?? 0;
              if (orderA !== orderB) return orderA - orderB;

              const timeA = a.event_date ? new Date(a.event_date).getTime() : (a.active_from ? new Date(a.active_from).getTime() : Infinity);
              const timeB = b.event_date ? new Date(b.event_date).getTime() : (b.active_from ? new Date(b.active_from).getTime() : Infinity);

              if (timeA !== timeB) return timeA - timeB;

              return new Date(a.created_at || 0) - new Date(b.created_at || 0);
            });
          });
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

  // Society Recruitment Tracker Analytics States
  const [societiesSubTab, setSocietiesSubTab] = useState('leaderboard'); // 'leaderboard' | 'roster'
  const [societySearch, setSocietySearch] = useState('');
  const [societyCategoryFilter, setSocietyCategoryFilter] = useState('all');
  const [societySortBy, setSocietySortBy] = useState('hearts'); // 'hearts' | 'filled' | 'conversion' | 'name'
  const [studentSocietySearch, setStudentSocietySearch] = useState('');
  const [studentSocietyCourseFilter, setStudentSocietyCourseFilter] = useState('All');
  const [studentSocietyActivityFilter, setStudentSocietyActivityFilter] = useState('All'); // 'All' | 'HasHearted' | 'HasFilled'
  const [selectedSocietyModal, setSelectedSocietyModal] = useState(null);

  // Computed metrics for Society Recruitment Analytics
  const societyMetrics = useMemo(() => {
    const heartMap = {};
    const filledMap = {};
    const userHeartDetails = {};
    const userFilledDetails = {};
    const topChoiceMap = {};

    let totalHeartsCount = 0;
    let totalFilledCount = 0;
    const engagedUsersSet = new Set();

    (analyticsUsers || []).forEach((u) => {
      const bookmarks = Array.isArray(u.societyBookmarks) ? u.societyBookmarks : [];
      const filled = Array.isArray(u.societyFilledForms) ? u.societyFilledForms : [];

      if (bookmarks.length > 0 || filled.length > 0) {
        engagedUsersSet.add(u.email || u.id);
      }

      bookmarks.forEach((sId, index) => {
        heartMap[sId] = (heartMap[sId] || 0) + 1;
        totalHeartsCount++;
        if (index === 0) {
          topChoiceMap[sId] = (topChoiceMap[sId] || 0) + 1;
        }
        if (!userHeartDetails[sId]) userHeartDetails[sId] = [];
        userHeartDetails[sId].push({ ...u, preferenceRank: index + 1 });
      });

      filled.forEach((sId) => {
        filledMap[sId] = (filledMap[sId] || 0) + 1;
        totalFilledCount++;
        if (!userFilledDetails[sId]) userFilledDetails[sId] = [];
        userFilledDetails[sId].push(u);
      });
    });

    const societyStats = DEMO_SOCIETIES.map((soc) => {
      const hearts = heartMap[soc.id] || 0;
      const topChoices = topChoiceMap[soc.id] || 0;
      const filled = filledMap[soc.id] || 0;
      const conversionRate = hearts > 0 ? Math.round((filled / hearts) * 100) : (filled > 0 ? 100 : 0);
      return {
        ...soc,
        hearts,
        topChoices,
        filled,
        conversionRate,
        heartUsers: userHeartDetails[soc.id] || [],
        filledUsers: userFilledDetails[soc.id] || [],
      };
    });

    const maxHearts = Math.max(...societyStats.map((s) => s.hearts), 1);
    const maxFilled = Math.max(...societyStats.map((s) => s.filled), 1);

    const sortedByEngagement = [...societyStats].sort((a, b) => (b.hearts + b.filled) - (a.hearts + a.filled));
    const topSociety = sortedByEngagement.length > 0 && (sortedByEngagement[0].hearts > 0 || sortedByEngagement[0].filled > 0)
      ? sortedByEngagement[0]
      : null;

    return {
      heartMap,
      filledMap,
      totalHeartsCount,
      totalFilledCount,
      engagedStudentsCount: engagedUsersSet.size,
      societyStats,
      maxHearts,
      maxFilled,
      topSociety,
    };
  }, [analyticsUsers]);

  const filteredSocietyStats = useMemo(() => {
    return societyMetrics.societyStats
      .filter((soc) => {
        const matchesSearch =
          !societySearch ||
          soc.name.toLowerCase().includes(societySearch.toLowerCase()) ||
          (soc.shortName && soc.shortName.toLowerCase().includes(societySearch.toLowerCase())) ||
          (soc.categoryLabel && soc.categoryLabel.toLowerCase().includes(societySearch.toLowerCase()));

        const matchesCat = societyCategoryFilter === 'all' || soc.category === societyCategoryFilter;

        return matchesSearch && matchesCat;
      })
      .sort((a, b) => {
        if (societySortBy === 'topChoice') return b.topChoices - a.topChoices || b.hearts - a.hearts;
        if (societySortBy === 'hearts') return b.hearts - a.hearts || b.filled - a.filled;
        if (societySortBy === 'filled') return b.filled - a.filled || b.hearts - a.hearts;
        if (societySortBy === 'conversion') return b.conversionRate - a.conversionRate || b.hearts - a.hearts;
        if (societySortBy === 'name') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [societyMetrics, societySearch, societyCategoryFilter, societySortBy]);

  const filteredStudentSocietyRoster = useMemo(() => {
    return (analyticsUsers || []).filter((u) => {
      const nameMatch = u.name && u.name.toLowerCase().includes(studentSocietySearch.toLowerCase());
      const emailMatch = u.email && u.email.toLowerCase().includes(studentSocietySearch.toLowerCase());
      const matchesSearch = !studentSocietySearch || nameMatch || emailMatch;

      const matchesCourse = studentSocietyCourseFilter === 'All' || u.course === studentSocietyCourseFilter;

      const hasBookmarks = u.societyBookmarks && u.societyBookmarks.length > 0;
      const hasFilled = u.societyFilledForms && u.societyFilledForms.length > 0;

      let matchesActivity = true;
      if (studentSocietyActivityFilter === 'HasHearted') matchesActivity = hasBookmarks;
      if (studentSocietyActivityFilter === 'HasFilled') matchesActivity = hasFilled;

      return matchesSearch && matchesCourse && matchesActivity;
    });
  }, [analyticsUsers, studentSocietySearch, studentSocietyCourseFilter, studentSocietyActivityFilter]);

  // Real-Time Online Presence & Time-Series Graph States
  const [onlinePresence, setOnlinePresence] = useState([]);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState(7); // 7, 30, 90
  const [analyticsMetric, setAnalyticsMetric] = useState('combined'); // 'combined' | 'visits' | 'clicks'
  const [analyticsSummary, setAnalyticsSummary] = useState({
    dateLabels: [],
    visits: { totals: {}, series: {} },
    clicks: { totals: {}, series: {} },
    combined: { totals: {}, series: {} },
    series: { total: [], home: [], 'society-tracker': [], timetable: [], 'find-prof': [], 'team-finder': [], waiver: [], gpa: [], buzz: [], profile: [], admin: [] },
    totals: { home: 0, 'society-tracker': 0, timetable: 0, 'find-prof': 0, 'team-finder': 0, waiver: 0, gpa: 0, buzz: 0, profile: 0, admin: 0, grandTotal: 0 },
    topFeatureName: 'Timetable',
    topFeatureCount: 0
  });
  const [enabledSeries, setEnabledSeries] = useState({
    home: true,
    'society-tracker': true,
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
        { id: 'm1', name: 'Aditya Singhani', email: 'aditya.25015@sscbs.du.ac.in', course: 'BMS', semester: '2', section: 'A', lastActiveMs: now - 60000 * 1, lastActive: 'Online', societyBookmarks: ['acm-sscbs', 'rotaract', 'kronos', 'bms-council'], societyFilledForms: ['acm-sscbs', 'rotaract'] },
        { id: 'm4', name: 'Riya Gupta', email: 'riya.25078@sscbs.du.ac.in', course: 'BBA FIA', semester: '4', section: 'B', lastActiveMs: now - 60000 * 2, lastActive: 'Online', societyBookmarks: ['kronos', 'finx', 'synergy'], societyFilledForms: ['kronos'] },
        { id: 'm6', name: 'Divya Sen', email: 'divya.25102@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '4', section: 'A', lastActiveMs: now - 60000 * 3, lastActive: '3 mins ago', societyBookmarks: ['acm-sscbs', 'kronos'], societyFilledForms: ['acm-sscbs'] },
        { id: 'm2', name: 'Manthan Kabra', email: 'manthan.25042@sscbs.du.ac.in', course: 'BMS', semester: '2', section: 'B', lastActiveMs: now - 60000 * 5, lastActive: '5 mins ago', societyBookmarks: ['bms-council', 'rotaract', 'ecell'], societyFilledForms: ['bms-council'] },
        { id: 'm16', name: 'Tushar Mehta', email: 'tushar.25244@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '8', section: 'A', lastActiveMs: now - 60000 * 6, lastActive: '6 mins ago', societyBookmarks: ['acm-sscbs'], societyFilledForms: [] },
        { id: 'm9', name: 'Ishaan Malhotra', email: 'ishaan.25145@sscbs.du.ac.in', course: 'BMS', semester: '4', section: 'D', lastActiveMs: now - 60000 * 12, lastActive: '12 mins ago', societyBookmarks: ['rotaract', 'synergy'], societyFilledForms: ['rotaract'] },
        { id: 'm14', name: 'Pranav Shah', email: 'pranav.25201@sscbs.du.ac.in', course: 'BMS', semester: '4', section: 'A', lastActiveMs: now - 60000 * 60, lastActive: '1 hour ago', societyBookmarks: ['kronos'], societyFilledForms: ['kronos'] },
        { id: 'm3', name: 'Kunal Sharma', email: 'kunal.25055@sscbs.du.ac.in', course: 'BBA FIA', semester: '2', section: 'A', lastActiveMs: now - 60000 * 120, lastActive: '2 hours ago', societyBookmarks: ['finx', 'ecell'], societyFilledForms: [] },
        { id: 'm18', name: 'Yash Vardhan', email: 'yash.25266@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '6', section: 'A', lastActiveMs: now - 60000 * 240, lastActive: '4 hours ago', societyBookmarks: ['acm-sscbs', 'kronos'], societyFilledForms: ['acm-sscbs'] },
        { id: 'm5', name: 'Arjun Verma', email: 'arjun.25091@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '6', section: 'A', lastActiveMs: now - 60000 * 1440, lastActive: '1 day ago', societyBookmarks: ['acm-sscbs'], societyFilledForms: [] },
        { id: 'm12', name: 'Mehak Preet', email: 'mehak.25189@sscbs.du.ac.in', course: 'BMS', semester: '8', section: 'C', lastActiveMs: now - 60000 * 4320, lastActive: '3 days ago', societyBookmarks: ['rotaract'], societyFilledForms: ['rotaract'] },
        { id: 'm7', name: 'Siddharth Jain', email: 'sid.25114@sscbs.du.ac.in', course: 'BMS', semester: '6', section: 'A', lastActiveMs: now - 60000 * 10000, lastActive: 'Offline', societyBookmarks: ['synergy'], societyFilledForms: [] },
        { id: 'm10', name: 'Ananya Roy', email: 'ananya.25156@sscbs.du.ac.in', course: 'Bsc Comp Sci', semester: '2', section: 'A', lastActiveMs: now - 60000 * 12000, lastActive: 'Offline', societyBookmarks: ['kronos'], societyFilledForms: [] },
        { id: 'm13', name: 'Neil Dsouza', email: 'neil.25199@sscbs.du.ac.in', course: 'BBA FIA', semester: '2', section: 'A', lastActiveMs: now - 60000 * 15000, lastActive: 'Offline', societyBookmarks: ['finx'], societyFilledForms: ['finx'] },
        { id: 'm17', name: 'Vanshika Goel', email: 'vansh.25255@sscbs.du.ac.in', course: 'BMS', semester: '6', section: 'C', lastActiveMs: now - 60000 * 20000, lastActive: 'Offline', societyBookmarks: ['ecell'], societyFilledForms: [] }
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
            lastActiveMs,
            societyBookmarks: Array.isArray(profile.society_bookmarks) ? profile.society_bookmarks : [],
            societyFilledForms: Array.isArray(profile.society_filled_forms) ? profile.society_filled_forms : [],
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

CRITICAL MANDATE: Output ONLY raw extracted timetable blocks using the EXACT template below. Do NOT add conversational intros, greetings ("Here is your timetable..."), explanations, or wrap-up notes. Begin immediately with the first === header block.

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
   - Each cell contains a faculty code (e.g., "MV", "SP", "RRS", "OS") that maps to a professor and subject via the LEGEND TABLE below

4. LEGEND TABLE (below each timetable grid):
   - Headers: S.No. | Paper Type | Paper Name | Faculty Name | Faculty Code | Faculty Load
   - Maps each short faculty code to the full paper name and full faculty name
   - Paper types include: Core, GE, SEC, DSE, VAC, AEC, AECC, DSC

═══════════════════════════════════════════════
CRITICAL EXTRACTION RULES
═══════════════════════════════════════════════

RULE 1 — FACULTY CODE & LEGEND RESOLUTION (MOST IMPORTANT):
  - Every cell contains faculty codes (e.g., "MV", "SP", "Deepali", "Sanchi", "Garima", "Soumya", "Komal", "OS", "KR", "RRS", "AyG").
  - STRICT LOCAL LEGEND PRIORITY & MULTI-SEMESTER PROFESSORS:
    * Faculty members teach DIFFERENT papers in DIFFERENT semesters!
    * EXAMPLE: "RRS" (Dr. Rishi Rajan Sahay) teaches "Statistics for Business Decisions" in Semester 1, but teaches "Introduction to Business Analytics" in Semester 3.
    * ALWAYS look up faculty codes in the LOCAL block's Legend Table for that specific semester/class block first.
    * NEVER reuse or carry over a paper name learned from one semester block to a different semester block.
  - "OS" CODE DISAMBIGUATION: In grid cells, "OS" ALWAYS stands for faculty member "Prof. Onkar Singh" (Operating Systems is the course paper title, never a teacher code).
  - CROSS-SHEET LEGEND FALLBACK: ONLY if a faculty code is completely missing from the local block legend, look it up in OTHER sheet legends in the workbook or map to full name (e.g. Dr. Garima Tripathi, Dr. Soumya Guliyan, Mr. Komal Sharma). NEVER let a cross-sheet lookup overwrite a valid local block legend mapping.
  - DISAMBIGUATING MULTIPLE MATCHES: If a faculty code matches multiple rows in a local legend (e.g., Soumya mapping to both Hindi B & C, KR mapping to Python & Front End, or Sushmita mapping to Core & VAC), inspect in-cell tags (e.g. "(Hin B)", "(Hin C)", "(SEC Lab)", "(VAC)") to pick the exact matching paper.

RULE 2 — COURSE NAME NORMALIZATION:
  - "BMS" → output as "BMS"
  - "BBA(FIA)" or "BBA (FIA)" → output as "BBA FIA"
  - "B.SC.(H) COMPUTER SCIENCE" → output as "Bsc Comp Sci"

RULE 3 — ANNOTATIONS, ROOM OVERRIDES & CS LAB RULES:
  - "(P)" or "(Prac)" = Practical class. Include "(Practical)" in the subject name.
  - CRITICAL: Subject titles containing the word "Practice" (e.g. "Environmental Science: Theory into Practice - 1") are THEORY lectures. Do NOT mark as "(Practical)" or practical unless "(P)" or "(Prac)" is explicitly annotated after the faculty code in the cell!
  - "(Tute)" = Tutorial. Include "(Tutorial)" in the subject name.
  - "(237)" or "(Room 651)" = Room number override. Extract as "Room 237" or "Room 651".
  - "(R)" or "(Room)" = Class takes place in the allotted block default room (Theory room).
  - Multi-room & Split Rooms (e.g., "(361/326)" or "MV (P) (361/326) / Priyanka (P) (715)"):
    Output rooms separated by "/": "Room 361 / Room 326 / Room 715" (or map per group if specified).
  - B.SC. CS LAB DEFAULT ROOMS: For B.Sc. Computer Science practical/lab classes without an explicit room number in the cell: Group 1 (G1 / Batch P1) defaults to "Lab 426", Group 2 (G2 / Batch P2) defaults to "Lab 460". Combined/theory classes go to the block default classroom.
  - "(Merged with BMS 3A)" = Merged class info. Include in subject but NOT in teacher name.
  - "(Unsupervised)" = No teacher present. Include subject title if known (e.g. "EE-1 (Practical) (Unsupervised)"), set teacher to "Unsupervised", room to "-".

RULE 4 — BATCH & GROUP SPLITS (G1/G2 vs PERIOD NAMES):
  - IMPORTANT: Daily class periods MUST be named "Period 1:" through "Period 7:".
  - Practical batch/group labels inside cells (like "P1", "P2", "G1", "G2") represent Practical Batches (e.g. Batch P1, Batch P2, Group G1, Group G2). Do NOT confuse batch labels ("P1"/"P2") with daily Class Periods ("Period 1" - "Period 7").
  - Leading Slashes (e.g. "/NR"): Output as "/ Ms. Nisha Rajput".
  - Trailing Slashes (e.g. "ST G1/"): Output G1 assignment for Sonika Thakral (G1), and leave G2 out or set as Free.
  - GROUP SPLIT SUBJECTS: ALWAYS prefix group subjects with "G1:" and "G2:"! Use slashes "/" between groups (DO NOT use pipes "|"):
    Output format:
      subject: "G1: [Subject1] / G2: [Subject2]"
      teacher: "[Full Name 1] (G1) / [Full Name 2] (G2)"
      room: "G1: Room XXX / G2: Room YYY"
    If both groups have the SAME subject, write the subject once:
      subject: "[Subject Name]"
      teacher: "[Full Name 1] (G1) / [Full Name 2] (G2)"
      room: "G1: Room XXX / G2: Room YYY"
  - ALWAYS INCLUDE BOTH ROOMS FOR GROUP SPLITS:
    If Group 1 has no explicit room written in the cell, it uses the block DEFAULT ROOM (e.g. Room 703).
    Output room as: "G1: Room 703 / G2: Room 226" (NEVER output just one room).

RULE 5 — ELECTIVE / LANGUAGE SPLITS:
  Some cells list multiple language/elective sections:
  Example: "Garima (Hin A) 607 / Soumya (Hin C) 644 / Komal (Hin D) 648"
  Output:
    subject: "Hindi A / Hindi C / Hindi D"
    teacher: "Dr. Garima Tripathi / Dr. Soumya Guliyan / Mr. Komal Sharma"
    room: "Room 607 / Room 644 / Room 648"

RULE 6 — EMPTY CELLS = FREE PERIOD:
  If a cell for a period is empty or missing:
    subject: "Free"
    teacher: "-"
    room: "-"

RULE 7 — ROOM NUMBER FORMAT:
  - Always prefix room numbers with "Room " (e.g., "Room 703", "Room 607", "Room 326")
  - Exception: "Lab 426", "Lab 460" stay as-is
  - If no room is specified in the cell, use the DEFAULT ROOM from the block header (or Lab 426 / Lab 460 for CS G1/G2 labs)

RULE 8 — PERIOD NUMBERING:
  Daily Class Periods MUST be explicitly written as:
  Period 1, Period 2, Period 3, BREAK, Period 4, Period 5, Period 6, Period 7

═══════════════════════════════════════════════
REQUIRED OUTPUT FORMAT (STRICT TEMPLATE)
═══════════════════════════════════════════════

Output EVERY timetable block in this EXACT format. Do not deviate.

=== [COURSE] | Semester [N] | Section [X] | [Default Room] ===
Monday:
  Period 1: [Subject Name] | [Full Teacher Name] | [Room]
  Period 2: [Subject Name] | [Full Teacher Name] | [Room]
  Period 3: [Subject Name] | [Full Teacher Name] | [Room]
  BREAK
  Period 4: [Subject Name] | [Full Teacher Name] | [Room]
  Period 5: [Subject Name] | [Full Teacher Name] | [Room]
  Period 6: [Subject Name] | [Full Teacher Name] | [Room]
  Period 7: [Subject Name] | [Full Teacher Name] | [Room]
Tuesday:
  Period 1: ...
  ...
Wednesday:
  ...
Thursday:
  ...
Friday:
  ...

IMPORTANT FORMATTING RULES:
- Every day MUST have exactly 7 period lines (Period 1-3, BREAK, Period 4-7)
- Use "Free | - | -" for empty/free periods
- The BREAK line has no subject/teacher/room, just the word "BREAK"
- Separate blocks with a blank line
- Use the FULL faculty name from the legend (e.g., "Dr. Mona Verma", NOT "MV")
- Use the FULL subject name from the legend (e.g., "Statistics for Business Decisions", NOT "SBD")
- Include "(Practical)" or "(Tutorial)" in the subject name where applicable
- For teacher names, use the exact prefix from the legend: Dr., Mr., Ms., Prof.

Extract ALL timetable blocks from the attached Excel file now:`;

  // ══════════════════════════════════════════════
  // DETERMINISTIC TEXT PARSER (Resilient Client-Side)
  // ══════════════════════════════════════════════
  const parseStructuredText = (rawText) => {
    const timetables = {};
    if (!rawText || typeof rawText !== 'string') return { timetables, parsedCount: 0, errorCount: 0 };

    // Strip markdown code fences (e.g. ```markdown ... ```) if LLM wrapped output
    const cleanedRawText = rawText
      .replace(/^```[a-z]*\s*/gim, '')
      .replace(/```$/gim, '')
      .trim();

    const blocks = cleanedRawText.split(/^===\s*/m).filter(b => b.trim());
    let parsedCount = 0;
    let errorCount = 0;

    for (const block of blocks) {
      try {
        // Parse header line: [COURSE] | Semester [N] | Section [X] | [Room] ===
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

        const secMatch = headerParts[2].match(/Section\s*([A-D])/i) 
          || headerParts[2].match(/Sec\s*[-:\s]?\s*([A-D])/i) 
          || headerParts[2].match(/\b([A-D])\b/i) 
          || headerParts[2].match(/([A-D])$/i);
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

            for (const pLine of periodLines) {
              const trimmed = pLine.trim();
              if (trimmed === 'BREAK' || trimmed.toLowerCase().includes('break')) {
                dayClasses.push({ period: 0, isBreak: true, subject: 'Infinity Hour (Break)', teacher: '', room: '' });
                continue;
              }

              // Ultra-resilient period match: handles P1:, P 1:, Period 1:, P1 -
              const pMatch = trimmed.match(/^(?:P|Period)\s*(\d+)[\s:-]+(.*)/i);
              if (pMatch) {
                const pNum = parseInt(pMatch[1]);
                const content = pMatch[2].trim();
                const parts = content.split('|').map(s => s.trim());

                let subject = 'Free';
                let teacher = '-';
                let room = defaultRoom;

                if (parts.length >= 4) {
                  // If line has 4+ parts due to pipe inside subject ("G1: Subj1 | G2: Subj2 | Teachers | Rooms")
                  let sub1 = parts[0];
                  let sub2 = parts[1];
                  if (!/^(?:G\d|P\d):/i.test(sub1)) sub1 = `G1: ${sub1}`;
                  if (!/^(?:G\d|P\d):/i.test(sub2)) sub2 = `G2: ${sub2}`;
                  subject = `${sub1} / ${sub2}`;
                  teacher = parts[2];
                  room = parts[3];
                } else if (parts.length === 3) {
                  subject = parts[0] || 'Free';
                  teacher = parts[1] || '-';
                  room = parts[2] || (subject === 'Free' ? '-' : defaultRoom);
                } else if (parts.length === 2) {
                  subject = parts[0] || 'Free';
                  teacher = parts[1] || '-';
                  room = subject === 'Free' ? '-' : defaultRoom;
                } else if (parts.length === 1) {
                  subject = parts[0] || 'Free';
                  teacher = '-';
                  room = '-';
                }

                // Auto-prefix G1: / G2: to group split subjects if LLM omitted them
                if (/(?:\(G[12]\)|\(P[12]\))/i.test(teacher) && subject.includes(' / ') && !/^(?:G\d|P\d):/i.test(subject)) {
                  const subParts = subject.split(' / ').map(s => s.trim());
                  if (subParts.length >= 2) {
                    subject = `G1: ${subParts[0]} / G2: ${subParts[1]}`;
                  }
                }

                // If teacher contains group indicators (e.g. (G1)/(G2) or (P1)/(P2)) but room is single room (e.g. Room 226), expand room with defaultRoom
                if (/(?:\(G[12]\)|\(P[12]\))/i.test(teacher) && room !== '-' && !room.includes('/') && !room.toLowerCase().includes('g1:')) {
                  room = `G1: ${defaultRoom} / G2: ${room}`;
                }

                const slot = { period: pNum, subject, teacher, room };
                
                // Infer practical flag if subject contains practical/lab keywords (excluding 'practice')
                if (/\b(practical|lab)\b/i.test(subject) || (/\bprac\b/i.test(subject) && !/\bpractice\b/i.test(subject))) {
                  slot.isPractical = true;
                }

                dayClasses.push(slot);
              }
            }
          }

          // Fill missing periods if incomplete
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

          // Guarantee strict period order: P1, P2, P3, BREAK (weight 3.5), P4, P5, P6, P7
          dayClasses.sort((a, b) => {
            const wA = a.isBreak ? 3.5 : (a.period || 0);
            const wB = b.isBreak ? 3.5 : (b.period || 0);
            return wA - wB;
          });

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
  // DETERMINISTIC AI TEXT PARSER
  // ══════════════════════════════════════════════
  const parseTimetableText = async (text, category) => {
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
        // Filter by category or keep all valid recognized courses
        const filtered = {};
        for (const [courseName, sems] of Object.entries(timetables)) {
          if (courseName === 'Bsc Comp Sci' || courseName === 'BMS' || courseName === 'BBA FIA') {
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
        addTextLog(`[${label}] ❌ No timetable blocks found in the text. Make sure the text follows the === COURSE | Semester N | Section X | Room === format.`, 'error');
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
    if (!window.confirm("Are you sure you want to scrap and remove all Management timetables (BBA FIA & BMS) across the OS?")) {
      return;
    }
    try {
      setIsSaving(true);
      setSaveStatus({ type: '', message: '' });

      const updatedDraft = JSON.parse(JSON.stringify(draftTimetable || timetable || {}));
      delete updatedDraft['BBA FIA'];
      delete updatedDraft['BMS'];
      if (updatedDraft._meta) {
        delete updatedDraft._meta.mgmtFileName;
        delete updatedDraft._meta.mgmtUploadTime;
      }

      setDraftTimetable(updatedDraft);
      await updateTimetable(updatedDraft);
      setHasUnpublishedChanges(false);
      setTextInputMgmt('');
      setTextParsedMgmt(null);
      setMgmtFile(null);
      setMgmtParsedData(null);

      setSaveStatus({ type: 'success', message: 'Management timetables (BBA FIA & BMS) scrapped successfully from OS and live dashboards!' });
      addLog("[System Admin] ✓ Scrapped Management timetables from live OS.", "success");
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to scrap Management timetables.' });
      addLog(`[System Admin] Error scrapping Management timetables: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Scrap / Wipe only B.Sc. Computer Science timetables
  const handleScrapCsTimetable = async () => {
    if (!window.confirm("Are you sure you want to scrap and remove all B.Sc. Computer Science timetables across the OS?")) {
      return;
    }
    try {
      setIsSaving(true);
      setSaveStatus({ type: '', message: '' });

      const updatedDraft = JSON.parse(JSON.stringify(draftTimetable || timetable || {}));
      delete updatedDraft['Bsc Comp Sci'];
      if (updatedDraft._meta) {
        delete updatedDraft._meta.csFileName;
        delete updatedDraft._meta.csUploadTime;
      }

      setDraftTimetable(updatedDraft);
      await updateTimetable(updatedDraft);
      setHasUnpublishedChanges(false);
      setTextInputCs('');
      setTextParsedCs(null);
      setCsFile(null);
      setCsParsedData(null);

      setSaveStatus({ type: 'success', message: 'B.Sc. Computer Science timetables scrapped successfully from OS and live dashboards!' });
      addLog("[System Admin] ✓ Scrapped B.Sc. Computer Science timetables from live OS.", "success");
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed to scrap B.Sc. CS timetables.' });
      addLog(`[System Admin] Error scrapping B.Sc. CS timetables: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Scrap / Wipe all active timetables
  const handleScrapActiveTimetables = async () => {
    if (!window.confirm("Are you sure you want to scrap and clear all timetable data across the entire SSCBS OS?")) {
      return;
    }
    try {
      setIsSaving(true);
      setSaveStatus({ type: '', message: '' });

      setDraftTimetable({});
      await updateTimetable({});
      setHasUnpublishedChanges(false);
      setTextInputMgmt('');
      setTextInputCs('');
      setTextParsedMgmt(null);
      setTextParsedCs(null);
      setMgmtFile(null);
      setCsFile(null);
      setMgmtParsedData(null);
      setCsParsedData(null);

      setSaveStatus({ type: 'success', message: 'All timetable data cleared from OS and live dashboards!' });
      addLog("[System Admin] ✓ Successfully cleared all timetable data across the OS!", "success");
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
    const data = (draftTimetable && Object.keys(draftTimetable).length > 0) ? draftTimetable : (timetable && Object.keys(timetable).length > 0 ? timetable : {});
    const keys = Object.keys(data).filter(k => k !== '_meta' && typeof data[k] === 'object');
    return keys.length > 0 ? keys : ['BMS', 'BBA FIA', 'Bsc Comp Sci'];
  };
  const getSemesters = () => {
    const data = (draftTimetable && Object.keys(draftTimetable).length > 0) ? draftTimetable : (timetable && Object.keys(timetable).length > 0 ? timetable : {});
    if (!data || !data[selectedCourse]) return ['1', '2', '3', '4', '5', '6', '7', '8'];
    const sems = Object.keys(data[selectedCourse]);
    return sems.length > 0 ? sems : ['1', '2', '3', '4', '5', '6', '7', '8'];
  };
  const getSections = () => {
    const data = (draftTimetable && Object.keys(draftTimetable).length > 0) ? draftTimetable : (timetable && Object.keys(timetable).length > 0 ? timetable : {});
    if (!data || !data[selectedCourse] || !data[selectedCourse][selectedSem]) return ['A', 'B', 'C', 'D'];
    const secs = Object.keys(data[selectedCourse][selectedSem]);
    return secs.length > 0 ? secs : ['A', 'B', 'C', 'D'];
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
            <span className="tab-icon">📅</span>
            <span className="tab-label">Schedules</span>
            <span className="tab-label-full"> & Timetable Manager</span>
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'notices' ? 'active' : ''}`}
            onClick={() => setActiveTab('notices')}
          >
            <span className="tab-icon">📢</span>
            <span className="tab-label">Notices</span>
            <span className="tab-label-full"> Board Manager</span>
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <span className="tab-icon">👥</span>
            <span className="tab-label">Demographics</span>
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'societies' ? 'active' : ''}`}
            onClick={() => setActiveTab('societies')}
          >
            <span className="tab-icon">❤️</span>
            <span className="tab-label">Societies</span>
            <span className="tab-label-full"> Tracker Analytics</span>
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'holidays' ? 'active' : ''}`}
            onClick={() => setActiveTab('holidays')}
          >
            <span className="tab-icon">🎉</span>
            <span className="tab-label">Holidays</span>
            <span className="tab-label-full"> & Fests</span>
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <span className="tab-icon">⚙️</span>
            <span className="tab-label">Settings</span>
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
                      onClick={() => parseTimetableText(textInputMgmt, 'mgmt')}
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
                      onClick={() => parseTimetableText(textInputCs, 'cs')}
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

              {/* Scrap All */}
              <div className="uploader-bottom-row">
                <button className="btn-scrap-all" onClick={handleScrapActiveTimetables} disabled={isSaving}>
                  🗑️ Clear ALL Timetables from Draft
                </button>
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

              {/* Timetable Slots Table & Mobile Cards */}
              <div className="schedule-table-container">
                <div className="desktop-schedule-table">
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

                {/* Mobile Cards View */}
                <div className="schedule-cards-mobile">
                  {getActiveDayClasses().length === 0 ? (
                    <div className="empty-schedule-card">
                      No classes found for {selectedCourse} Sem {selectedSem} Section {selectedSection} on {selectedDay}.
                    </div>
                  ) : (
                    getActiveDayClasses().map((slot, idx) => {
                      const isEditing = editingSlotIdx === idx;
                      return (
                        <div key={idx} className={`mobile-slot-card ${slot.isBreak ? 'is-break' : ''}`}>
                          <div className="slot-card-header">
                            <span className="slot-period-badge">
                              {slot.isBreak ? 'Infinity Hour' : `Period ${slot.period}`}
                            </span>
                            {!isEditing && (
                              <button className="btn-action-edit-mobile" onClick={() => handleEditClick(idx, slot)}>
                                ✏️ Edit
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="slot-card-edit-form">
                              <label>
                                <span>Subject Title</span>
                                <input
                                  type="text"
                                  value={editFields.subject}
                                  onChange={(e) => setEditFields(prev => ({ ...prev, subject: e.target.value }))}
                                  className="admin-edit-input"
                                />
                              </label>
                              <label>
                                <span>Professor Name</span>
                                <input
                                  type="text"
                                  value={editFields.teacher}
                                  onChange={(e) => setEditFields(prev => ({ ...prev, teacher: e.target.value }))}
                                  className="admin-edit-input"
                                  disabled={slot.isBreak}
                                />
                              </label>
                              <label>
                                <span>Classroom</span>
                                <input
                                  type="text"
                                  value={editFields.room}
                                  onChange={(e) => setEditFields(prev => ({ ...prev, room: e.target.value }))}
                                  className="admin-edit-input"
                                  disabled={slot.isBreak}
                                />
                              </label>
                              <div className="slot-edit-actions">
                                <button className="btn-action-save" onClick={handleManualSave}>Save Slot</button>
                                <button className="btn-action-cancel" onClick={() => setEditingSlotIdx(null)}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="slot-card-details">
                              <div className="slot-subject">{slot.subject}</div>
                              {!slot.isBreak && (
                                <div className="slot-meta-row">
                                  {slot.teacher && <span className="slot-teacher">👨‍🏫 {slot.teacher}</span>}
                                  {slot.room && <span className="slot-room">📍 Room {slot.room}</span>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </div>
        ) : activeTab === 'notices' ? (
          <div className={`tab-pane notices-pane ${noticeMobileSection === 'form' ? 'show-form' : 'show-list'}`}>
            <div className="admin-mobile-notice-switcher">
              <button
                type="button"
                className={`mobile-switcher-btn ${noticeMobileSection === 'list' ? 'active' : ''}`}
                onClick={() => setNoticeMobileSection('list')}
              >
                📋 Notice Board ({noticesList.length})
              </button>
              <button
                type="button"
                className={`mobile-switcher-btn ${noticeMobileSection === 'form' ? 'active' : ''}`}
                onClick={() => setNoticeMobileSection('form')}
              >
                {editingNoticeId ? '✏️ Edit Notice' : '➕ Create Notice'}
              </button>
            </div>
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
                                {notice.event_date && <div className="notice-info-item notice-info-event">📅 Event: {new Date(notice.event_date).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'})}</div>}
                                {notice.venue && <div className="notice-info-item notice-info-venue">📍 Venue: {notice.venue}</div>}
                                {notice.active_from && <div className="notice-info-item notice-info-start">🟢 Start: {new Date(notice.active_from).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'})}</div>}
                                {notice.active_to && <div className="notice-info-item notice-info-expire">🔴 Expire: {new Date(notice.active_to).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'})}</div>}
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
            {/* Promo Banner for Society Recruitment Analytics */}
            <div
              className="society-analytics-promo-banner"
              onClick={() => setActiveTab('societies')}
              style={{
                cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.12), rgba(168, 85, 247, 0.12))',
                border: '1px solid rgba(236, 72, 153, 0.35)',
                borderRadius: '14px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
                boxShadow: '0 4px 14px rgba(236, 72, 153, 0.08)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '28px' }}>❤️</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--ink)' }}>
                    Society Recruitment Tracker Analytics
                  </h4>
                  <p style={{ margin: '3px 0 0', fontSize: '0.84rem', color: 'var(--ink-dim)' }}>
                    Real-time tracking of societies students are favoriting (❤️ {societyMetrics.totalHeartsCount}) and marking forms filled (✅ {societyMetrics.totalFilledCount}).
                  </p>
                </div>
              </div>
              <button
                className="btn-access-denied-back"
                style={{ whiteSpace: 'nowrap', padding: '8px 16px', fontSize: '0.85rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('societies');
                }}
              >
                View Society Analytics →
              </button>
            </div>

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
                            'society-tracker': { bg: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' },
                            timetable: { bg: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' },
                            'find-prof': { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
                            'team-finder': { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
                            'empty-room': { bg: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9', border: 'rgba(14, 165, 233, 0.3)' },
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
                  <>
                    <div className="table-scroll-container-admin">
                      <table className="registry-table-admin">
                        <thead>
                          <tr>
                            <th style={{ width: '60px', textAlign: 'center' }}>S.No.</th>
                            <th>Student Name</th>
                            <th>Email Address</th>
                            <th>Course</th>
                            <th>Class</th>
                            <th>Last Activity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((student, idx) => (
                            <tr key={student.id}>
                              <td style={{ textAlign: 'center' }}>
                                <span className="registry-serial-num">
                                  #{idx + 1}
                                </span>
                              </td>
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

                    <div className="registry-cards-mobile">
                      {filtered.map((student, idx) => (
                        <div className="registry-student-card" key={student.id}>
                          <div className="student-card-header">
                            <span className="registry-card-serial">#{idx + 1}</span>
                            <span className="registry-user-avatar">
                              {student.name.charAt(0).toUpperCase()}
                            </span>
                            <div className="student-card-info">
                              <strong className="student-card-name">{student.name}</strong>
                              <span className="student-card-email">{student.email}</span>
                            </div>
                            {student.lastActive === 'Online' ? (
                              <span className="registry-status-online">Online</span>
                            ) : (
                              <span className="registry-status-offline">{student.lastActive}</span>
                            )}
                          </div>
                          <div className="student-card-meta">
                            <span className="registry-badge-course">{student.course}</span>
                            <span className="registry-badge-class">Sem {student.semester} - {student.section}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        ) : activeTab === 'societies' ? (
          /* Society Recruitment Tracker Analytics Tab */
          <div className="tab-pane societies-pane">
            
            {/* Metric Summary Cards */}
            <div className="analytics-stats-grid">
              <div className="stat-card-admin highlight-pink" style={{ background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.12), rgba(219, 39, 119, 0.05))', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
                <div className="card-icon">❤️</div>
                <h4>Total Favorited Hearts</h4>
                <p className="stat-number" style={{ color: '#ec4899' }}>{societyMetrics.totalHeartsCount}</p>
                <p className="stat-subtitle">Across all students & societies</p>
              </div>

              <div className="stat-card-admin highlight-green" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.05))', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div className="card-icon">✅</div>
                <h4>Forms Filled (Applied)</h4>
                <p className="stat-number" style={{ color: '#10b981' }}>{societyMetrics.totalFilledCount}</p>
                <p className="stat-subtitle">Students marked recruitment forms filled</p>
              </div>

              <div className="stat-card-admin highlight-purple" style={{ background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(147, 51, 234, 0.05))', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                <div className="card-icon">🎯</div>
                <h4>Active Applicants</h4>
                <p className="stat-number" style={{ color: '#a855f7' }}>{societyMetrics.engagedStudentsCount}</p>
                <p className="stat-subtitle">Students with ≥1 heart or checkmark</p>
              </div>

              <div className="stat-card-admin highlight-blue" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.05))', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <div className="card-icon">🔥</div>
                <h4>Top Trending Society</h4>
                <p className="stat-number" style={{ fontSize: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#3b82f6' }}>
                  {societyMetrics.topSociety ? (societyMetrics.topSociety.shortName || societyMetrics.topSociety.name) : 'No Activity'}
                </p>
                <p className="stat-subtitle">
                  {societyMetrics.topSociety ? `${societyMetrics.topSociety.hearts} ❤️ • ${societyMetrics.topSociety.filled} ✅` : 'Awaiting student activity'}
                </p>
              </div>
            </div>

            {/* Sub-navigation Sub-Tabs */}
            <div className="registry-card-admin" style={{ marginBottom: '20px', padding: '16px 20px' }}>
              <div className="flex-between flex-wrap gap-3">
                <div className="admin-subtabs" style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`admin-subtab-btn ${societiesSubTab === 'leaderboard' ? 'active' : ''}`}
                    onClick={() => setSocietiesSubTab('leaderboard')}
                  >
                    🏆 Society Popularity Leaderboard ({DEMO_SOCIETIES.length})
                  </button>
                  <button
                    className={`admin-subtab-btn ${societiesSubTab === 'roster' ? 'active' : ''}`}
                    onClick={() => setSocietiesSubTab('roster')}
                  >
                    👤 Student-by-Student Roster ({analyticsUsers.length})
                  </button>
                </div>

                {societiesSubTab === 'leaderboard' ? (
                  <div className="registry-filters-selects" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Search society name..."
                      value={societySearch}
                      onChange={(e) => setSocietySearch(e.target.value)}
                      className="search-input-admin"
                      style={{ maxWidth: '200px' }}
                    />
                    <select
                      value={societyCategoryFilter}
                      onChange={(e) => setSocietyCategoryFilter(e.target.value)}
                      className="admin-select"
                      style={{ minWidth: '150px' }}
                    >
                      <option value="all">All Domains</option>
                      {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>
                    <select
                      value={societySortBy}
                      onChange={(e) => setSocietySortBy(e.target.value)}
                      className="admin-select"
                      style={{ minWidth: '140px' }}
                    >
                      <option value="hearts">Sort by Hearts ❤️</option>
                      <option value="topChoice">Sort by #1 Top Choice 👑</option>
                      <option value="filled">Sort by Forms Filled ✅</option>
                      <option value="conversion">Sort by Conversion %</option>
                      <option value="name">Sort Alphabetically</option>
                    </select>
                  </div>
                ) : (
                  <div className="registry-filters-selects" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Search student or email..."
                      value={studentSocietySearch}
                      onChange={(e) => setStudentSocietySearch(e.target.value)}
                      className="search-input-admin"
                      style={{ maxWidth: '200px' }}
                    />
                    <select
                      value={studentSocietyCourseFilter}
                      onChange={(e) => setStudentSocietyCourseFilter(e.target.value)}
                      className="admin-select"
                    >
                      <option value="All">All Courses</option>
                      <option value="BMS">BMS</option>
                      <option value="BBA FIA">BBA FIA</option>
                      <option value="Bsc Comp Sci">BSc CS</option>
                    </select>
                    <select
                      value={studentSocietyActivityFilter}
                      onChange={(e) => setStudentSocietyActivityFilter(e.target.value)}
                      className="admin-select"
                    >
                      <option value="All">All Activity</option>
                      <option value="HasHearted">Has Hearted ❤️</option>
                      <option value="HasFilled">Has Applied ✅</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* LEADERBOARD VIEW */}
            {societiesSubTab === 'leaderboard' && (
              <div className="registry-card-admin">
                <div className="chart-header-admin">
                  <h3>🏆 Society Recruitment Popularity Leaderboard</h3>
                  <p className="section-desc-small">
                    Breakdown of student preferences across all 45 SSCBS college societies. Click any society to inspect student details.
                  </p>
                </div>

                {filteredSocietyStats.length === 0 ? (
                  <div className="no-registry-results">
                    <p>No societies match your search filter.</p>
                  </div>
                ) : (
                  <div className="table-scroll-container-admin">
                    <table className="registry-table-admin society-leaderboard-table">
                      <thead>
                        <tr>
                          <th style={{ width: '50px', textAlign: 'center' }}>Rank</th>
                          <th>Society Name & Category</th>
                          <th style={{ width: '150px' }}>Hearts (Favorited)</th>
                          <th style={{ width: '150px' }}>Forms Filled (Applied)</th>
                          <th style={{ width: '120px' }}>Conversion Rate</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSocietyStats.map((soc, idx) => {
                          const heartPct = Math.min(100, Math.round((soc.hearts / societyMetrics.maxHearts) * 100));
                          const filledPct = Math.min(100, Math.round((soc.filled / societyMetrics.maxFilled) * 100));

                          return (
                            <tr key={soc.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedSocietyModal(soc)}>
                              <td style={{ textAlign: 'center', fontWeight: 800, color: idx < 3 ? 'var(--accent)' : 'var(--ink-dim)' }}>
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                              </td>
                              <td>
                                <div>
                                  <strong style={{ fontSize: '0.95rem', color: 'var(--ink)' }}>{soc.name}</strong>
                                  <div style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
                                    <span className="course-sem-chip" style={{ fontSize: '0.7rem' }}>
                                      {soc.categoryLabel || 'Society'}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontWeight: 800, color: '#ec4899', fontSize: '0.92rem' }}>
                                    ❤️ {soc.hearts} {soc.hearts === 1 ? 'student' : 'students'}
                                  </span>
                                  {soc.topChoices > 0 && (
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d97706' }}>
                                      👑 {soc.topChoices} #1 Choice{soc.topChoices > 1 ? 's' : ''}
                                    </span>
                                  )}
                                  <div className="bar-track-admin" style={{ height: '5px' }}>
                                    <div className="bar-fill-admin" style={{ width: `${heartPct}%`, background: '#ec4899' }} />
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontWeight: 800, color: '#10b981', fontSize: '0.92rem' }}>
                                    ✅ {soc.filled} {soc.filled === 1 ? 'form' : 'forms'}
                                  </span>
                                  <div className="bar-track-admin" style={{ height: '5px' }}>
                                    <div className="bar-fill-admin" style={{ width: `${filledPct}%`, background: '#10b981' }} />
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="active-view-chip" style={{
                                  backgroundColor: soc.conversionRate > 50 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                  color: soc.conversionRate > 50 ? '#10b981' : '#f59e0b',
                                  borderColor: soc.conversionRate > 50 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                                }}>
                                  ⚡ {soc.conversionRate}%
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="admin-action-btn view-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSocietyModal(soc);
                                  }}
                                  title="View interested students"
                                >
                                  👁️ Details
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* STUDENT ROSTER VIEW */}
            {societiesSubTab === 'roster' && (
              <div className="registry-card-admin">
                <div className="chart-header-admin">
                  <h3>👤 Student Society Selections Roster</h3>
                  <p className="section-desc-small">
                    Detailed list of verified students and their exact favorited (❤️) and checkmarked (✅) societies.
                  </p>
                </div>

                {filteredStudentSocietyRoster.length === 0 ? (
                  <div className="no-registry-results">
                    <p>No student records match the search filter.</p>
                  </div>
                ) : (
                  <div className="table-scroll-container-admin">
                    <table className="registry-table-admin">
                      <thead>
                        <tr>
                          <th style={{ width: '50px', textAlign: 'center' }}>S.No</th>
                          <th>Student Name & Email</th>
                          <th>Course & Class</th>
                          <th>❤️ Favorited Societies</th>
                          <th>✅ Forms Marked Filled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudentSocietyRoster.map((usr, idx) => {
                          const bookmarks = Array.isArray(usr.societyBookmarks) ? usr.societyBookmarks : [];
                          const filled = Array.isArray(usr.societyFilledForms) ? usr.societyFilledForms : [];

                          return (
                            <tr key={usr.id || usr.email}>
                              <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--ink-dim)' }}>
                                #{idx + 1}
                              </td>
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
                                {bookmarks.length === 0 ? (
                                  <span style={{ fontSize: '0.78rem', color: 'var(--ink-dim)', fontStyle: 'italic' }}>None</span>
                                ) : (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {bookmarks.map((sId) => {
                                      const found = DEMO_SOCIETIES.find(s => s.id === sId);
                                      const label = found ? found.shortName || found.name : sId;
                                      return (
                                        <span
                                          key={sId}
                                          className="society-chip-heart"
                                          onClick={() => found && setSelectedSocietyModal(found)}
                                          title={found ? found.name : sId}
                                        >
                                          ❤️ {label}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                              <td>
                                {filled.length === 0 ? (
                                  <span style={{ fontSize: '0.78rem', color: 'var(--ink-dim)', fontStyle: 'italic' }}>None</span>
                                ) : (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {filled.map((sId) => {
                                      const found = DEMO_SOCIETIES.find(s => s.id === sId);
                                      const label = found ? found.shortName || found.name : sId;
                                      return (
                                        <span
                                          key={sId}
                                          className="society-chip-filled"
                                          onClick={() => found && setSelectedSocietyModal(found)}
                                          title={found ? found.name : sId}
                                        >
                                          ✅ {label}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
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
                          <div className="notice-info-item notice-info-event">📅 {new Date(holiday.date).toDateString()}</div>
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
                { id: 'society-tracker', label: 'Society Recruitment Tracker', desc: 'Real-time recruitment tracker and deadlines for SSCBS societies' },
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

        {selectedSocietyModal && (
          <div className="society-modal-backdrop" onClick={() => setSelectedSocietyModal(null)}>
            <div className="society-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="society-modal-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--ink)' }}>{selectedSocietyModal.name}</h3>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <span className="course-sem-chip">{selectedSocietyModal.categoryLabel || 'Society'}</span>
                    {selectedSocietyModal.shortName && (
                      <span className="course-sem-chip" style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent)' }}>
                        @{selectedSocietyModal.shortName}
                      </span>
                    )}
                  </div>
                </div>
                <button className="society-modal-close" onClick={() => setSelectedSocietyModal(null)}>✕</button>
              </div>

              <div className="society-modal-body">
                <div className="society-modal-stats-row">
                  <div className="modal-stat-box">
                    <span className="modal-stat-icon">❤️</span>
                    <span className="modal-stat-val" style={{ color: '#ec4899' }}>{selectedSocietyModal.hearts}</span>
                    <span className="modal-stat-lbl">Hearted</span>
                  </div>
                  <div className="modal-stat-box">
                    <span className="modal-stat-icon">👑</span>
                    <span className="modal-stat-val" style={{ color: '#d97706' }}>{selectedSocietyModal.topChoices || 0}</span>
                    <span className="modal-stat-lbl">#1 Top Choice</span>
                  </div>
                  <div className="modal-stat-box">
                    <span className="modal-stat-icon">✅</span>
                    <span className="modal-stat-val" style={{ color: '#10b981' }}>{selectedSocietyModal.filled}</span>
                    <span className="modal-stat-lbl">Forms Filled</span>
                  </div>
                  <div className="modal-stat-box">
                    <span className="modal-stat-icon">⚡</span>
                    <span className="modal-stat-val" style={{ color: '#3b82f6' }}>{selectedSocietyModal.conversionRate}%</span>
                    <span className="modal-stat-lbl">Conversion Rate</span>
                  </div>
                </div>

                <div className="modal-section-divider">
                  <h4>❤️ Students Interested ({selectedSocietyModal.heartUsers.length})</h4>
                  {selectedSocietyModal.heartUsers.length === 0 ? (
                    <p className="section-desc-small" style={{ fontStyle: 'italic' }}>No students have favorited this society yet.</p>
                  ) : (
                    <div className="modal-user-list">
                      {selectedSocietyModal.heartUsers.map((u) => (
                        <div key={u.id || u.email} className="modal-user-item">
                          <span className="online-avatar-badge">{u.name ? u.name.charAt(0).toUpperCase() : 'S'}</span>
                          <div>
                            <strong className="student-name-text">{u.name}</strong>
                            <span className="student-email-text">
                              {u.email} • {u.course} Sem {u.semester}
                              {u.preferenceRank && (
                                <span className={`course-sem-chip ${u.preferenceRank === 1 ? 'top-choice-chip' : ''}`} style={{ marginLeft: '6px' }}>
                                  #{u.preferenceRank} Choice
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="modal-section-divider">
                  <h4>✅ Students Applied / Forms Filled ({selectedSocietyModal.filledUsers.length})</h4>
                  {selectedSocietyModal.filledUsers.length === 0 ? (
                    <p className="section-desc-small" style={{ fontStyle: 'italic' }}>No students have marked form filled for this society yet.</p>
                  ) : (
                    <div className="modal-user-list">
                      {selectedSocietyModal.filledUsers.map((u) => (
                        <div key={u.id || u.email} className="modal-user-item green-border">
                          <span className="online-avatar-badge green">{u.name ? u.name.charAt(0).toUpperCase() : 'S'}</span>
                          <div>
                            <strong className="student-name-text">{u.name}</strong>
                            <span className="student-email-text">{u.email} • {u.course} Sem {u.semester}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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

