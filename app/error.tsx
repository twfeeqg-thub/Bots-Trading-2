'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Router Boundary Error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
      <div className="max-w-md w-full space-y-4 p-6 rounded-xl border border-red-500/20 bg-slate-900/60">
        <h2 className="text-lg font-semibold text-red-400">حدث خطأ في النظام</h2>
        <p className="text-xs text-slate-400">
          {error?.message || 'تعذر استكمال العملية الحالية.'}
        </p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
