'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/shared/Sidebar';
import { useAuthStore } from '@/lib/store/auth.store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasHydrated, token } = useAuthStore();
  const router = useRouter();

  // Keep the middleware cookie in sync with the persisted token after reload.
  // Without this, an expired cookie + valid localStorage would bounce the user
  // back to /login on the next request.
  useEffect(() => {
    if (hasHydrated && token) {
      document.cookie = `trade_token=${token}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
    }
  }, [hasHydrated, token]);

  // Only enforce auth AFTER Zustand finishes rehydrating from localStorage.
  // Otherwise a fresh reload sees isAuthenticated=false for one tick → wrongful redirect.
  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
