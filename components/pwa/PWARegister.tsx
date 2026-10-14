'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // SW registered successfully
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn('SW registration warning:', err);
        });
    }
  }, []);

  return null;
}
