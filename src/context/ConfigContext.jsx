import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';

const DEFAULT_FEATURE_FLAGS = {
  'timetable': true,
  'find-prof': true,
  'team-finder': true,
  'waiver': false,
  'gpa': true,
  'pyqs': false,
  'buzz': true,
  'contact': true,
};

const ConfigContext = createContext({
  featureFlags: DEFAULT_FEATURE_FLAGS,
  updateFeatureFlags: async () => {},
  loading: true,
});

export const ConfigProvider = ({ children }) => {
  const [featureFlags, setFeatureFlags] = useState(() => {
    try {
      const cached = localStorage.getItem('sscbs_os_feature_flags');
      if (cached) return { ...DEFAULT_FEATURE_FLAGS, ...JSON.parse(cached) };
    } catch (e) {}
    return DEFAULT_FEATURE_FLAGS;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConfigs() {
      if (!hasValidCredentials) {
        setLoading(false);
        return;
      }
      try {
        const { data: metaData, error: metaError } = await supabase
          .from('system_configs')
          .select('updated_at')
          .eq('key', 'feature_flags')
          .maybeSingle();

        const serverUpdatedAt = metaData?.updated_at || null;
        const cachedUpdatedAt = localStorage.getItem('sscbs_os_feature_flags_updated_at');
        const cachedFlags = localStorage.getItem('sscbs_os_feature_flags');

        if (!metaError && serverUpdatedAt && cachedUpdatedAt === serverUpdatedAt && cachedFlags) {
          try {
            setFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, ...JSON.parse(cachedFlags) });
            setLoading(false);
            return;
          } catch (e) {}
        }

        const { data, error } = await supabase
          .from('system_configs')
          .select('value, updated_at')
          .eq('key', 'feature_flags')
          .maybeSingle();

        if (error) {
          console.error('Error fetching feature flags:', error);
        } else if (data && data.value) {
          const newFlags = { ...DEFAULT_FEATURE_FLAGS, ...data.value };
          setFeatureFlags(newFlags);
          try {
            localStorage.setItem('sscbs_os_feature_flags', JSON.stringify(newFlags));
            if (data.updated_at) {
              localStorage.setItem('sscbs_os_feature_flags_updated_at', data.updated_at);
            }
          } catch (e) {}
        }
      } catch (err) {
        console.error('Failed to connect to Supabase for config:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchConfigs();
  }, []);

  const updateFeatureFlags = async (newFlags) => {
    const updatedFlags = { ...featureFlags, ...newFlags };
    setFeatureFlags(updatedFlags);
    try { localStorage.setItem('sscbs_os_feature_flags', JSON.stringify(updatedFlags)); } catch (e) {}

    if (!hasValidCredentials) {
      console.warn('Supabase not configured. Feature flags updated in-memory only.');
      return;
    }

    const { error } = await supabase
      .from('system_configs')
      .upsert({
        key: 'feature_flags',
        value: updatedFlags,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error saving feature flags to Supabase:', error);
      throw error;
    }
  };

  return (
    <ConfigContext.Provider value={{ featureFlags, updateFeatureFlags, loading }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => useContext(ConfigContext);
