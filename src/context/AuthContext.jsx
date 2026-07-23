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

  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let sessionResolved = false;

    // Check if URL hash or search parameters indicate password recovery link
    if (
      typeof window !== 'undefined' &&
      (window.location.hash.includes('type=recovery') ||
       window.location.search.includes('type=recovery') ||
       window.location.hash.includes('reset-password'))
    ) {
      setIsPasswordRecovery(true);
    }

    // Hard fallback timeout (2 seconds max) so the app NEVER hangs on loading screen
    const fallbackTimeout = setTimeout(() => {
      if (isMounted && !sessionResolved) {
        setLoading(false);
      }
    }, 2000);

    if (!hasValidCredentials) {
      if (isMounted) setLoading(false);
      clearTimeout(fallbackTimeout);
      return;
    }

    let subscription = null;

    try {
      // Get initial auth session from Supabase
      supabase.auth.getSession()
        .then(({ data: { session } = {} }) => {
          if (!isMounted) return;
          sessionResolved = true;
          clearTimeout(fallbackTimeout);
          setSession(session ?? null);
          setUser(session?.user ?? null);
          setLoading(false);
        })
        .catch((err) => {
          console.warn('Auth getSession notice:', err);
          if (!isMounted) return;
          sessionResolved = true;
          clearTimeout(fallbackTimeout);
          setLoading(false);
        });

      // Listen for real-time auth state changes (sign in, sign out, token refresh, password recovery)
      const res = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;
        sessionResolved = true;
        clearTimeout(fallbackTimeout);
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }
        setSession(session ?? null);
        setUser(session?.user ?? null);
        setLoading(false);
      });
      subscription = res?.data?.subscription;
    } catch (err) {
      console.warn('Auth initialization non-blocking notice:', err);
      if (isMounted) {
        sessionResolved = true;
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
      if (subscription && typeof subscription.unsubscribe === 'function') {
        try { subscription.unsubscribe(); } catch (e) {}
      }
    };
  }, []);

  const signUp = async (email, password, metadata = {}) => {
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const resetPassword = async (email) => {
    const redirectUrl = `${window.location.origin}/#reset-password`;
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) throw error;
    return data;
  };

  const updatePassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    setIsPasswordRecovery(false);
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateProfile = async (profileData) => {
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
        resetPassword,
        updatePassword,
        isPasswordRecovery,
        setIsPasswordRecovery,
        updateProfile,
        isConfigured: hasValidCredentials,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

