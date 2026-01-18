'use client';

import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useRouter, usePathname } from 'next/navigation';

export default function AppNativeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleBackButton = async () => {
        // If on root or login, exit app
        if (pathname === '/' || pathname === '/login' || pathname === '/join') {
            CapacitorApp.exitApp();
        } else {
            // Otherwise go back in history
            router.back();
        }
    };

    const listener = CapacitorApp.addListener('backButton', handleBackButton);

    return () => {
        listener.then(handler => handler.remove());
    };
  }, [router, pathname]);

  return <>{children}</>;
}