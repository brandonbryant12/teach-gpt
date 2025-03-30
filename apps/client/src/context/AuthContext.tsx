import React, { createContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { teachGptClient } from '../lib/client';
import { UserProfile, LoginCredentials, RegisterUserData } from '../lib/client/types';
import { getTokenFromStorage, setTokenInStorage } from '../lib/utils/storage';

interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (userData: RegisterUserData) => Promise<void>;
  logout: () => void;
  fetchUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(getTokenFromStorage());
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const profileData = await teachGptClient.auth.getProfile();
      setUser(profileData);
      setError(null);
    } catch (fetchError) {
      console.error('Profile fetch error:', fetchError);
      setToken(null);
      setUser(null);
      setTokenInStorage(null);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load user profile.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const currentToken = getTokenFromStorage();
    if (currentToken) {
      setToken(currentToken);
      fetchUserProfile();
    } else {
      setToken(null);
      setUser(null);
      setIsLoading(false);
    }
  }, [fetchUserProfile]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    setUser(null);
    setToken(null);
    setTokenInStorage(null);
    try {
      const data = await teachGptClient.auth.login(credentials);
      setToken(data.access_token);
      setTokenInStorage(data.access_token);
      await fetchUserProfile();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed');
      setToken(null);
      setUser(null);
      setTokenInStorage(null);
      throw loginError;
    }
  }, [fetchUserProfile]);

  const register = useCallback(async (userData: RegisterUserData) => {
    setIsLoading(true);
    setError(null);
    setUser(null);
    setToken(null);
    setTokenInStorage(null);
    try {
      await teachGptClient.auth.register(userData);
      await login({ email: userData.email, password: userData.password });
    } catch (registerOrLoginError) {
      setError(registerOrLoginError instanceof Error ? registerOrLoginError.message : 'An error occurred during sign-up.');
      setToken(null);
      setUser(null);
      setTokenInStorage(null);
      throw registerOrLoginError;
    }
  }, [login]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setTokenInStorage(null);
    setError(null);
  }, []);

  const value = useMemo(() => ({
    token,
    user,
    isLoading,
    error,
    login,
    register,
    logout,
    fetchUserProfile,
  }), [token, user, isLoading, error, login, register, logout, fetchUserProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthContext }; 