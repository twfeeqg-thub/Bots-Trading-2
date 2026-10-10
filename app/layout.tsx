import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { ThemeProvider } from '@/components/theme/ThemeContext';

export const metadata: Metadata = {
  title: 'بوت(٢) مراقبة صعود العملات | مشروع Q',
  description: 'تطبيق بوتات مراقبة العملات وإجراء الصفقات - مشروع Q',
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
    icon: '/favicon.ico',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('project_q_theme_mode');if(t==='light'){document.documentElement.classList.add('light');document.documentElement.classList.remove('dark');document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="antialiased selection:bg-emerald-500 selection:text-white min-h-screen transition-colors duration-200">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
