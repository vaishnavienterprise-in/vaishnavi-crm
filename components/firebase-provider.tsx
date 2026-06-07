'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authReady: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  authReady: false,
  error: null,
  login: async () => {},
  logout: async () => {},
  setError: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Enforce exact email restriction
        const isAllowed = currentUser.email?.toLowerCase() === 'vaishnavienterprise.print@gmail.com';
        if (isAllowed) {
          setUser(currentUser);
          setError(null);
        } else {
          // Instantly kick out unauthorized users
          setUser(null);
          await signOut(auth);
          setError('Access Denied. Only vaishnavienterprise.print@gmail.com is authorized to access this CRM.');
        }
      } else {
        setUser(null);
      }
      setLoading(false);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const isAllowed = result.user.email?.toLowerCase() === 'vaishnavienterprise.print@gmail.com';
      if (!isAllowed) {
        await signOut(auth);
        setError('Access Denied. Only vaishnavienterprise.print@gmail.com is authorized.');
        setUser(null);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err?.message || 'Authentication failed. Please check popup permissions.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext value={{ user, loading, authReady, error, login, logout, setError }}>
      {children}
    </AuthContext>
  );
}
