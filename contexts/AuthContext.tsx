import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  loading: boolean;
  error?: Error | null;
  /**
   * True if the user must login (not loading, and either session or user is missing).
   * Use this in your navigation/layout to redirect to login screen if true.
   */
  loginRequired: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Timeout fallback if auth hangs for too long
  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => {
      if (loading) {
        console.error('[AuthProvider] Timeout: loading still true after 10s, forcing false');
        setLoading(false);
        setError(new Error('Timeout: Auth loading took too long'));
      }
    }, 15000); // Increased timeout to 15s for slower networks
    return () => clearTimeout(timeout);
  }, [loading]);

  // Rehydrate session manually from AsyncStorage
  const reloadSessionFromStorage = async () => {
    try {
      const value = await AsyncStorage.getItem('supabase.auth.token');
      if (!value) return false;

      const parsed = JSON.parse(value);
      if (!parsed || !parsed.currentSession) return false;

      await supabase.auth.setSession(parsed.currentSession);
      console.log('[AuthProvider] Rehydrated session from AsyncStorage');
      return true;
    } catch (e) {
      console.error('[AuthProvider] Failed to rehydrate session:', e);
      return false;
    }
  };

  // Session fetch with retry logic
  const fetchSessionWithRetry = async (retryCount = 1) => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) throw error || new Error('No session found');

      setSession(session);
      console.log('[AuthProvider] Initial session:', session);
      if (session?.user) {
        await fetchUserProfile(session.user);
      } else {
        setUser(null);
      }
    } catch (err: any) {
      console.error('[AuthProvider] Error getting initial session:', err);

      const shouldRetry = retryCount > 0 && err?.message?.includes('Refresh Token Not Found');
      if (shouldRetry) {
        console.warn('[AuthProvider] Refresh token issue. Attempting rehydration...');
        const success = await reloadSessionFromStorage();
        if (success) {
          return fetchSessionWithRetry(retryCount - 1);
        }
      }

      setError(err);
      setUser(null);
    }
  };

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const doFetch = async () => {
      setLoading(true);
      await fetchSessionWithRetry();
      if (isMounted) {
        setLoading(false);
        setIsInitialLoad(false);
      }
    };
    doFetch();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      console.log('[AuthProvider] Auth state changed:', event, session);
      // Only show loading on initial load or explicit sign in/out, not for TOKEN_REFRESHED
      if (event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          // Update user in background, no loading state
          await fetchUserProfile(session.user, { background: true });
        }
        // Do not set loading to true/false
        return;
      }
      // For other events (SIGNED_IN, SIGNED_OUT, etc)
      setLoading(true);
      if (session?.user) {
        await fetchUserProfile(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Add retry and background option
  const fetchUserProfile = async (supabaseUser: SupabaseUser, opts?: { background?: boolean, maxRetries?: number }) => {
    const maxRetries = opts?.maxRetries ?? 2;
    let attempt = 0;
    let lastError = null;
    while (attempt <= maxRetries) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', supabaseUser.id)
          .single();

        if (error && error.code === 'PGRST116') {
          // Create initial user profile if not exists
          const newUser = {
            id: supabaseUser.id,
            email: supabaseUser.email!,
            full_name: supabaseUser.user_metadata?.full_name || '',
            subscription_status: 'free' as const,
          };

          const { data: createdUser, error: createError } = await supabase
            .from('users')
            .upsert(newUser)
            .select()
            .single();

          if (createError) throw createError;
          setUser(createdUser);
          console.log('[AuthProvider] Created new user profile', createdUser);
          return createdUser;
        } else if (error) {
          console.error('[AuthProvider] Error fetching user:', error);
          setUser(null);
          setError(error);
          lastError = error;
        } else {
          setUser(data);
          console.log('[AuthProvider] Loaded user profile', data);
          return data;
        }
      } catch (error) {
        console.error('[AuthProvider] Error in fetchUserProfile:', error);
        setUser(null);
        setError(error as Error);
        lastError = error;
      }
      attempt++;
      // If not background, optionally add a short delay before retry
      if (!opts?.background) await new Promise(res => setTimeout(res, 400));
    }
    // If all retries fail, only force logout if not background
    if (!opts?.background) setUser(null);
    return null;
  };


  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    await AsyncStorage.removeItem('supabase.auth.token');
  };

  console.log('[AuthProvider] Rendering provider', { session, user, loading, error });

  const loginRequired = !loading && (!session || !user);

  return (
    <AuthContext.Provider value={{
      session,
      user,
      signUp,
      signIn,
      signOut,
      loading,
      error,
      loginRequired,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
