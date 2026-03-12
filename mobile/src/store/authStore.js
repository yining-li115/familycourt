/**
 * Minimal auth state using React Context + AsyncStorage.
 * Phase 2 can migrate to Zustand/Redux if needed.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, usersApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (token) {
        const me = await usersApi.me();
        setUser(me);
      }
    } catch {
      await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
    } finally {
      setLoading(false);
    }
  }

  async function login(phone, code, nickname) {
    const data = await authApi.verify(phone, code, nickname);
    await AsyncStorage.setItem('access_token', data.access_token);
    await AsyncStorage.setItem('refresh_token', data.refresh_token);
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    try {
      await authApi.logout(refreshToken);
    } catch {}
    await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
    setUser(null);
  }

  function updateUser(updates) {
    setUser((prev) => ({ ...prev, ...updates }));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
