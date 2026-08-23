'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'teacher' | 'student';
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, full_name: string, role: 'teacher' | 'student') => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('classpulse_token');
    const storedUser = localStorage.getItem('classpulse_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('classpulse_token');
        localStorage.removeItem('classpulse_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('classpulse_token', data.token);
      localStorage.setItem('classpulse_user', JSON.stringify(data.user));
      return { success: true };
    } catch {
      return { success: false, error: 'Network error connecting to backend server' };
    }
  };

  const signup = async (
    email: string,
    password: string,
    full_name: string,
    role: 'teacher' | 'student'
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name, role }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Signup failed' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('classpulse_token', data.token);
      localStorage.setItem('classpulse_user', JSON.stringify(data.user));
      return { success: true };
    } catch {
      return { success: false, error: 'Network error connecting to backend server' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('classpulse_token');
    localStorage.removeItem('classpulse_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
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
