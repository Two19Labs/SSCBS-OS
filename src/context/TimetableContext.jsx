import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';
import timetablesData from '../data/timetables.json';

const TimetableContext = createContext({
  timetable: timetablesData,
  loading: true,
  updateTimetable: async () => {},
  getTimetable: () => null,
});

export const TimetableProvider = ({ children }) => {
  const [timetable, setTimetable] = useState(() => {
    try {
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
  const [loading, setLoading] = useState(false);

  // Fetch timetable configuration on load
  useEffect(() => {
    async function fetchTimetable() {
      if (!hasValidCredentials) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('system_configs')
          .select('value')
          .eq('key', 'timetable')
          .maybeSingle();

        if (error) {
          console.error('Error fetching timetable from Supabase:', error);
        } else if (data && data.value && typeof data.value === 'object' && Object.keys(data.value).length > 0) {
          setTimetable(data.value);
          try {
            localStorage.setItem('sscbs_os_timetable', JSON.stringify(data.value));
          } catch (e) {}
        }
      } catch (err) {
        console.error('Failed to connect to Supabase timetable storage:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTimetable();
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
    if (!timetable || Object.keys(timetable).length === 0) return ['2', '4', '6', '8'];
    
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
    if (sems.length === 0) return ['2', '4', '6', '8'];
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
      }}
    >
      {children}
    </TimetableContext.Provider>
  );
};

export const useTimetable = () => useContext(TimetableContext);
