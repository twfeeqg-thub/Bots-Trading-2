import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-4 text-center">
      <div className="max-w-md w-full space-y-4 p-8 rounded-xl border border-slate-800 bg-slate-900/60 shadow-lg">
        <div className="text-4xl font-bold text-emerald-400">404</div>
        <h1 className="text-xl font-semibold text-slate-100">الصفحة غير موجودة</h1>
        <p className="text-sm text-slate-400">
          لم يتم العثور على المسار المطلوب في نظام مشروع Q.
        </p>
        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-medium text-sm transition-colors"
          >
            العودة إلى الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
