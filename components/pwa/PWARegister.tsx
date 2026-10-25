'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {
          // Non-fatal if sw.js is not present or service worker registration fails in dev/iframe
        });
    }
  }, []);

  return null;
}
