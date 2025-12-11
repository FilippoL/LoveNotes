import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { authService } from '../services/auth';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Load cached user on mount
  useEffect(() => {
    const loadCachedUser = async () => {
      try {
        const cachedUser = await authService.getCachedUser();
        if (cachedUser) {
          setUser(cachedUser);
        }
      } catch (error) {
        console.error('Error loading cached user:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCachedUser();
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData);
        } catch (error) {
          console.error('Error loading user data:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    try {
      const userData = await authService.login(email, password);
      setUser(userData);
    } catch (error: any) {
      setLoading(false);
      throw error;
    }
    setLoading(false);
  };

  const register = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<void> => {
    setLoading(true);
    try {
      const userData = await authService.register(email, password, displayName);
      setUser(userData);
    } catch (error: any) {
      setLoading(false);
      throw error;
    }
    setLoading(false);
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } catch (error: any) {
      setLoading(false);
      throw error;
    }
    setLoading(false);
  };

  const resetPassword = async (email: string): Promise<void> => {
    await authService.resetPassword(email);
  };

  const refreshUser = async (forceRefresh: boolean = false): Promise<void> => {
    try {
      const userData = await authService.getCurrentUser(forceRefresh);
      console.log('[AuthContext] refreshUser - Updated user:', userData ? { id: userData.id, partnerId: userData.partnerId, connectionStatus: userData.connectionStatus } : null);
      setUser(userData);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    resetPassword,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

