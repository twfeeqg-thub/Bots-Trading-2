'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-950 text-slate-100 flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-xl border border-red-500/30 bg-slate-900">
          <h2 className="text-xl font-bold text-red-400">خطأ عام في التطبيق</h2>
          <p className="text-sm text-slate-400">
            {error?.message || 'واجه التطبيق خطأ غير متوقع.'}
          </p>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition-colors"
          >
            إعادة تحميل التطبيق
          </button>
        </div>
      </body>
    </html>
  );
}
