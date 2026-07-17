import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, hasValidCredentials } from '../lib/supabaseClient';

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  updateProfile: async () => {},
  isConfigured: false,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasValidCredentials) {
      // In sandbox mode, load mock user from local storage
      const savedUser = localStorage.getItem('sandbox_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email, password, metadata = {}) => {
    if (!hasValidCredentials) {
      // Sandbox mode registration
      const mockUser = {
        id: 'sandbox-user-id',
        email,
        user_metadata: {
          full_name: metadata.full_name || email.split('@')[0],
          ...metadata
        }
      };
      setUser(mockUser);
      localStorage.setItem('sandbox_user', JSON.stringify(mockUser));
      return { user: mockUser };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email, password) => {
    if (!hasValidCredentials) {
      // Sandbox mode sign-in
      const mockUser = {
        id: 'sandbox-user-id',
        email,
        user_metadata: {
          full_name: email.split('@')[0],
        }
      };
      // Merge with existing profile data if saved
      const savedUser = localStorage.getItem('sandbox_user');
      const finalUser = savedUser ? { ...mockUser, ...JSON.parse(savedUser) } : mockUser;
      
      setUser(finalUser);
      localStorage.setItem('sandbox_user', JSON.stringify(finalUser));
      return { user: finalUser };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    if (!hasValidCredentials) {
      setUser(null);
      setSession(null);
      localStorage.removeItem('sandbox_user');
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateProfile = async (profileData) => {
    if (!hasValidCredentials) {
      // Sandbox mode: Update local state and local storage
      const updatedUser = {
        ...user,
        user_metadata: {
          ...user?.user_metadata,
          ...profileData
        }
      };
      setUser(updatedUser);
      localStorage.setItem('sandbox_user', JSON.stringify(updatedUser));
      return updatedUser;
    }

    // Supabase auth metadata update
    const { data, error } = await supabase.auth.updateUser({
      data: profileData
    });
    if (error) throw error;

    // Supabase user_progress table settings update
    try {
      // Query settings column in user_progress
      const { data: progressData, error: selectError } = await supabase
        .from('user_progress')
        .select('settings')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (!selectError) {
        const existingSettings = progressData?.settings || {};
        const newSettings = { ...existingSettings, ...profileData, email: data.user.email };

        await supabase
          .from('user_progress')
          .update({ settings: newSettings })
          .eq('user_id', data.user.id);
      }
    } catch (e) {
      console.error('Error updating user_progress profile settings:', e);
    }

    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        updateProfile,
        isConfigured: hasValidCredentials,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
