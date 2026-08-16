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

const CURRENT_TIMETABLE_VERSION = '2026-08-16-wef-v18';

// Course keys as stored in timetables.json, mapped from the variants that show
// up in profiles and uploads. Returns null when the course is unknown.
const COURSE_ALIASES = {
  'bms': 'BMS',
  'bba fia': 'BBA FIA',
  'bba(fia)': 'BBA FIA',
  'bba-fia': 'BBA FIA',
  'fia': 'BBA FIA',
  'bsc comp sci': 'Bsc Comp Sci',
  'bsc cs': 'Bsc Comp Sci',
  'b.sc. cs': 'Bsc Comp Sci',
  'cs': 'Bsc Comp Sci',
  'computer science': 'Bsc Comp Sci',
};

export const normalizeCourse = (course, data) => {
  if (!course) return null;
  if (data && data[course]) return course;
  return COURSE_ALIASES[String(course).trim().toLowerCase()] || null;
};

// Profiles store bare keys ('1', 'A'), but some callers still pass the older
// 'Semester 1' / 'Section A' labels.
const normalizeSemester = (semester) =>
  String(semester ?? '').trim().replace(/^sem(ester)?\s*/i, '');

const normalizeSection = (section) =>
  String(section ?? '').trim().replace(/^sec(tion)?\s*/i, '').toUpperCase();

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

  // Fetch live timetable config from Supabase on mount
  useEffect(() => {
    async function fetchTimetableAndHolidays() {
      if (!hasValidCredentials) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        // 1. Fetch live timetable config metadata from Supabase system_configs (ultra-lightweight ~50B query)
        const { data: metaData, error: metaError } = await supabase
          .from('system_configs')
          .select('updated_at')
          .eq('key', 'timetable')
          .maybeSingle();

        const serverUpdatedAt = metaData?.updated_at || null;
        const cachedUpdatedAt = localStorage.getItem('sscbs_os_timetable_last_updated');
        const cachedRaw = localStorage.getItem('sscbs_os_timetable');

        let cacheHit = false;
        if (!metaError && serverUpdatedAt && cachedUpdatedAt === serverUpdatedAt && cachedRaw) {
          try {
            const parsed = JSON.parse(cachedRaw);
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
              setTimetable(parsed);
              cacheHit = true;
            }
          } catch (e) {}
        }

        // Only download full timetable JSON (~200KB+) if server timestamp changed or cache missing
        if (!cacheHit) {
          const { data: configData, error: configError } = await supabase
            .from('system_configs')
            .select('value, updated_at')
            .eq('key', 'timetable')
            .maybeSingle();

          if (!configError && configData && configData.value && typeof configData.value === 'object') {
            setTimetable(configData.value);
            try {
              localStorage.setItem('sscbs_os_timetable', JSON.stringify(configData.value));
              if (configData.updated_at) {
                localStorage.setItem('sscbs_os_timetable_last_updated', configData.updated_at);
              }
            } catch (e) {}
          }
        }

        // 2. Fetch holidays
        const { data: holidayData, error: holidayError } = await supabase
          .from('holidays')
          .select('id, title, date, type')
          .order('date', { ascending: true });
        if (!holidayError && holidayData) {
          setHolidays(holidayData);
        }
      } catch (err) {
        console.error('Failed to fetch timetable config or holidays from Supabase:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTimetableAndHolidays();
  }, []);

  // Update timetable function (Admin only)
  const updateTimetable = async (newTimetable) => {
    const nowIso = new Date().toISOString();
    setTimetable(newTimetable);
    try {
      localStorage.setItem('sscbs_os_timetable', JSON.stringify(newTimetable));
      localStorage.setItem('sscbs_os_timetable_last_updated', nowIso);
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
        updated_at: nowIso,
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
    // Only fall back to static timetablesData if timetable has not been loaded at all (null)
    const dataToSearch = timetable !== null ? timetable : timetablesData;
    if (!dataToSearch) return null;

    const matchedCourse = normalizeCourse(course, dataToSearch);

    // Never fall back to another course or default data if the course has been scrapped:
    const cData = matchedCourse ? dataToSearch[matchedCourse] : null;
    if (!cData) return null;

    const sData = cData[semester] || cData[normalizeSemester(semester)];
    if (!sData) return null;

    // Section fallback only when the semester is published as a single combined block
    const sectionKeys = Object.keys(sData);
    const secData = sData[section]
      || sData[normalizeSection(section)]
      || (sectionKeys.length === 1 ? sData[sectionKeys[0]] : null);
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
