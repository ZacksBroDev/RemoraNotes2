import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { authApi } from '../lib/api';

interface User {
  _id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  mode: 'manual' | 'assisted' | 'both';
  plan: 'free' | 'pro' | 'team';
  grantedScopes: string[];
  timezone: string;
  digestTime: string;
  digestEnabled: boolean;
  onboardingCompleted: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetchUser = async () => {
    // Prevent multiple fetches
    if (hasFetched.current) return;
    hasFetched.current = true;

    try {
      const response = await authApi.getMe();
      setUser(response.data.data.user);
    } catch {
      // Not logged in - this is expected, not an error
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = () => {
    window.location.href = authApi.getGoogleAuthUrl();
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    }
    setUser(null);
    window.location.href = '/login';
  };

  const refetch = async () => {
    hasFetched.current = false;
    setIsLoading(true);
    await fetchUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refetch,
      }}
    >
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
