import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import timetablesData from '../data/timetables.json';

const TimetableContext = createContext({
  timetable: timetablesData,
  loading: true,
  updateTimetable: async () => {},
  getTimetable: () => null,
  holidays: [],
  addHoliday: async () => {},
  deleteHoliday: async () => {},
});

const CURRENT_TIMETABLE_VERSION = '2026-07-30-odd-sem-v10';

export const TimetableProvider = ({ children }) => {
  const [timetable, setTimetable] = useState(() => {
    try {
      const cachedVer = localStorage.getItem('sscbs_os_timetable_version');
      if (cachedVer !== CURRENT_TIMETABLE_VERSION) {
        localStorage.removeItem('sscbs_os_timetable');
        localStorage.setItem('sscbs_os_timetable_version', CURRENT_TIMETABLE_VERSION);
        return timetablesData;
      }
      const cached = localStorage.getItem('sscbs_os_timetable');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read cached timetable from localStorage:', e);
    }
    return timetablesData;
  });
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);

  // Timetable is sourced directly from timetablesData (src/data/timetables.json)
  useEffect(() => {
    setLoading(false);

    async function fetchHolidays() {
      if (!hasValidCredentials) return;
      try {
        const { data, error } = await supabase
          .from('holidays')
          .select('*')
          .order('date', { ascending: true });
        if (!error && data) {
          setHolidays(data);
        }
      } catch (err) {
        console.error('Failed to fetch holidays:', err);
      }
    }

    fetchHolidays();
  }, []);

  // Update timetable function (Admin only)
  const updateTimetable = async (newTimetable) => {
    setTimetable(newTimetable);
    try {
      localStorage.setItem('sscbs_os_timetable', JSON.stringify(newTimetable));
    } catch (e) {}

    if (!hasValidCredentials) {
      console.warn('Supabase not configured. Timetable updated in-memory and localStorage only.');
      return;
    }

    const { error } = await supabase
      .from('system_configs')
      .upsert({
        key: 'timetable',
        value: newTimetable,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error saving timetable to Supabase:', error);
      throw error;
    }
  };

  // Add a holiday (Admin only)
  const addHoliday = async (holiday) => {
    if (!hasValidCredentials) throw new Error('Supabase not configured');
    
    const { data, error } = await supabase
      .from('holidays')
      .insert([holiday])
      .select()
      .single();
      
    if (error) {
      console.error('Error adding holiday:', error);
      throw error;
    }
    
    setHolidays([...holidays, data].sort((a, b) => new Date(a.date) - new Date(b.date)));
    return data;
  };

  // Delete a holiday (Admin only)
  const deleteHoliday = async (id) => {
    if (!hasValidCredentials) throw new Error('Supabase not configured');
    
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting holiday:', error);
      throw error;
    }
    
    setHolidays(holidays.filter(h => h.id !== id));
  };

  // Helper to extract timetable dynamically
  const getTimetable = (course, semester, section) => {
    const dataToSearch = (timetable && Object.keys(timetable).length > 0) ? timetable : timetablesData;
    if (!dataToSearch) return null;

    // Standardize course name variations
    let matchedCourse = course;
    if (!dataToSearch[course]) {
      if (course === 'BBA(FIA)' || course === 'BBA-FIA' || course === 'FIA') {
        matchedCourse = 'BBA FIA';
      } else if (course === 'BSc CS' || course === 'CS' || course === 'Computer Science' || course === 'BSc Comp Sci') {
        matchedCourse = 'Bsc Comp Sci';
      }
    }

    const cData = dataToSearch[matchedCourse] || dataToSearch['BMS'] || dataToSearch[Object.keys(dataToSearch)[0]];
    if (!cData) return null;

    const sData = cData[semester] || cData[Object.keys(cData)[0]];
    if (!sData) return null;

    const secData = sData[section] || sData[Object.keys(sData)[0]];
    return secData || null;
  };

  // Helper to get active semesters dynamically for a course or across all courses
  const getActiveSemesters = (course) => {
    if (!timetable || Object.keys(timetable).length === 0) return ['1', '3', '5', '7'];
    
    if (course && timetable[course]) {
      const sems = Object.keys(timetable[course]);
      if (sems.length > 0) return sems.sort((a, b) => parseInt(a) - parseInt(b));
    }
    
    // Gather all semesters across all available courses
    const set = new Set();
    Object.keys(timetable).forEach(c => {
      if (timetable[c]) {
        Object.keys(timetable[c]).forEach(s => set.add(s));
      }
    });
    
    const sems = Array.from(set);
    if (sems.length === 0) return ['1', '3', '5', '7'];
    return sems.sort((a, b) => parseInt(a) - parseInt(b));
  };

  return (
    <TimetableContext.Provider
      value={{
        timetable,
        loading,
        updateTimetable,
        getTimetable,
        getActiveSemesters,
        holidays,
        addHoliday,
        deleteHoliday,
      }}
    >
      {children}
    </TimetableContext.Provider>
  );
};

export const useTimetable = () => useContext(TimetableContext);
