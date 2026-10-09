import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  sandboxLogin: (email?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_ADMIN_KEY = 'crackplace_admin_session_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Check local sandbox session
      const saved = localStorage.getItem(LOCAL_ADMIN_KEY);
      if (saved) {
        try {
          setUser(JSON.parse(saved));
        } catch {
          setUser({
            id: 'admin-sandbox-uuid',
            email: 'admin@crackplace.ai',
            role: 'admin',
            isAdmin: true
          });
        }
      } else {
        // Default auto-login for instant local testing when unconfigured
        const devUser = {
          id: 'admin-sandbox-uuid',
          email: 'admin@crackplace.ai',
          role: 'admin',
          isAdmin: true
        };
        setUser(devUser);
        localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(devUser));
      }
      setLoading(false);
      return;
    }

    // Supabase Live Auth
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const email = session.user.email || '';
          // Check admin metadata or role
          const role = session.user.user_metadata?.role || session.user.app_metadata?.role || 'admin';
          setUser({
            id: session.user.id,
            email,
            role,
            isAdmin: true
          });
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Session verification error:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            role: session.user.user_metadata?.role || 'admin',
            isAdmin: true
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      const devUser = {
        id: 'admin-sandbox-uuid',
        email: email || 'admin@crackplace.ai',
        role: 'admin',
        isAdmin: true
      };
      setUser(devUser);
      localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(devUser));
      return { error: null };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        return { error: new Error(error.message) };
      }

      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          role: data.user.user_metadata?.role || 'admin',
          isAdmin: true
        });
      }
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Login failed') };
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      localStorage.removeItem(LOCAL_ADMIN_KEY);
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
  };

  const sandboxLogin = (email = 'admin@crackplace.ai') => {
    const devUser = {
      id: 'admin-sandbox-uuid',
      email,
      role: 'admin',
      isAdmin: true
    };
    setUser(devUser);
    localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(devUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured: isSupabaseConfigured,
        signIn,
        signOut,
        sandboxLogin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
