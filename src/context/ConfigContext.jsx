import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';

const DEFAULT_FEATURE_FLAGS = {
  'find-prof': true,
  'waiver': false,
  'gpa': true,
  'pyqs': false,
  'buzz': true,
};

const ConfigContext = createContext({
  featureFlags: DEFAULT_FEATURE_FLAGS,
  updateFeatureFlags: async () => {},
  loading: true,
});

export const ConfigProvider = ({ children }) => {
  const [featureFlags, setFeatureFlags] = useState(DEFAULT_FEATURE_FLAGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConfigs() {
      if (!hasValidCredentials) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('system_configs')
          .select('value')
          .eq('key', 'feature_flags')
          .maybeSingle();

        if (error) {
          console.error('Error fetching feature flags:', error);
        } else if (data && data.value) {
          setFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, ...data.value });
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
