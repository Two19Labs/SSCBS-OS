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

    // Check if URL hash indicates password recovery link
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setIsPasswordRecovery(true);
    }

    // Hard fallback timeout (2 seconds max) so the app NEVER hangs on loading screen
    const fallbackTimeout = setTimeout(() => {
      if (isMounted && !sessionResolved) {
        setLoading(false);
      }
    }, 2000);

    if (!hasValidCredentials) {
      try {
        const savedUser = localStorage.getItem('sandbox_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      } catch (e) {
        // ignore JSON parse error
      }
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

  const resetPassword = async (email) => {
    if (!hasValidCredentials) {
      // Sandbox mode
      return { message: 'Password reset link sent (Sandbox mode).' };
    }
    const redirectUrl = `${window.location.origin}/#reset-password`;
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) throw error;
    return data;
  };

  const updatePassword = async (newPassword) => {
    if (!hasValidCredentials) {
      // Sandbox mode
      return { message: 'Password updated successfully (Sandbox mode).' };
    }
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    setIsPasswordRecovery(false);
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

  const directStudentAccess = async (email = 'aditya.25015@sscbs.du.ac.in') => {
    const studentUser = {
      id: 'local-student-id',
      email: email,
      user_metadata: {
        full_name: email.split('@')[0],
        course: 'BMS',
        semester: '2',
        section: 'A',
      }
    };
    try {
      const savedUser = localStorage.getItem('sandbox_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.email) {
          setUser(parsed);
          return parsed;
        }
      }
    } catch (e) {}
    setUser(studentUser);
    localStorage.setItem('sandbox_user', JSON.stringify(studentUser));
    return studentUser;
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
        directStudentAccess,
        isConfigured: hasValidCredentials,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

