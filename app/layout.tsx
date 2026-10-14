import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme/ThemeContext';
import { PWARegister } from '@/components/pwa/PWARegister';
import { PWAFlowBanner } from '@/components/pwa/PWAInstallPrompt';

export const viewport: Viewport = {
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: 'بوت(٢) مراقبة صعود العملات | مشروع Q',
  description: 'تطبيق بوتات مراقبة العملات وإجراء الصفقات - مشروع Q',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'بوت الصعود',
  },
  openGraph: {
    title: 'بوت(٢) مراقبة صعود العملات | مشروع Q',
    description: 'تطبيق بوتات مراقبة العملات وإجراء الصفقات - مشروع Q',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'بوت(٢) مراقبة صعود العملات | مشروع Q',
    description: 'تطبيق بوتات مراقبة العملات وإجراء الصفقات - مشروع Q',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              var m=localStorage.getItem('project_q_theme_mode_pref')||localStorage.getItem('project_q_theme_mode');
              var a=localStorage.getItem('project_q_theme_accent')||'gold';
              var isDark = true;
              if(m==='light'){ isDark = false; }
              else if(m==='system' && window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches){ isDark = false; }
              var root = document.documentElement;
              if(isDark){ root.classList.add('dark'); root.classList.remove('light'); root.setAttribute('data-theme','dark'); }
              else { root.classList.add('light'); root.classList.remove('dark'); root.setAttribute('data-theme','light'); }
              root.setAttribute('data-accent', a);
            }catch(e){}})();`,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="antialiased selection:bg-amber-500 selection:text-slate-950 min-h-screen transition-colors duration-200"
      >
        <ThemeProvider>
          <PWARegister />
          {children}
          <PWAFlowBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
