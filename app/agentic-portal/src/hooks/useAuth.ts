'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export type UserRole = 'platform_admin' | 'org_admin' | 'member' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  organizationId: string | null;
  organizationName?: string;
  role: UserRole;
  isPlatformAdmin: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Login failed');
    }
    
    const data = await res.json();
    setUser(data.user);
    return data.user;
  };

  const register = async (email: string, password: string, name?: string, organizationName?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, organizationName }),
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Registration failed');
    }
    
    const data = await res.json();
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/');
  };

  const canAccessPlatformAdmin = user?.isPlatformAdmin === true;
  const canAccessOrgAdmin = user?.isPlatformAdmin === true || 
                            user?.role === 'org_admin' || 
                            user?.role === 'platform_admin';

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refetch: fetchUser,
    canAccessPlatformAdmin,
    canAccessOrgAdmin,
  };
}
