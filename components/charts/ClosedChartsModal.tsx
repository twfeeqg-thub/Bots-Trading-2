// Project Q — Phase 4: Closed Charts Modal
// Closed Specification: List closed charts, Restore (not subject to 10 limit), Delete Permanently (with confirmation)
'use client';

import React, { useState } from 'react';
import { 
  X, 
  Archive, 
  RotateCcw, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  Layers 
} from 'lucide-react';
import { ChartItemConfig } from '@/lib/charts/chart-persistence';

interface ClosedChartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  closedCharts: ChartItemConfig[];
  onRestoreChart: (chartId: string) => void;
  onPermanentDeleteChart: (chartId: string) => void;
}

export function ClosedChartsModal({
  isOpen,
  onClose,
  closedCharts,
  onRestoreChart,
  onPermanentDeleteChart,
}: ClosedChartsModalProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const chartToDelete = closedCharts.find((c) => c.id === confirmDeleteId);

  const formatClosedTime = (timestamp?: number) => {
    if (!timestamp) return 'سابقاً';
    const d = new Date(timestamp);
    return d.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150 overflow-hidden">
      <div className="theme-modal-dialog w-full max-w-lg rounded-2xl border shadow-2xl p-4 sm:p-5 text-slate-100 space-y-3.5 max-h-[90dvh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="theme-modal-header shrink-0 flex items-center justify-between border-b pb-3 -mx-4 -mt-4 px-4 pt-4 sm:-mx-5 sm:-mt-5 sm:px-5 sm:pt-5 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="theme-heading text-sm font-semibold">الشارتات المغلقة ({closedCharts.length})</h3>
              <p className="text-[11px] opacity-75">
                يمكن استعادة أي شارت مغلق بكامل إعداداته، أو حذفه نهائياً
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Permanent Delete Confirmation Dialog */}
        {confirmDeleteId && chartToDelete && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-rose-300 font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>تأكيد الحذف النهائي</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              هل أنت متأكد من حذف شارت <strong className="text-rose-400 font-mono">{chartToDelete.symbol}</strong> ({chartToDelete.timeframe}) نهائياً؟
              <br />
              <span className="text-rose-400/90 font-medium">
                سيتم مسح إعدادات الشارت والخطوط الأفقية ({chartToDelete.horizontalLines.length} خطوط) بالكامل، ولا يمكن استعادته بعد ذلك.
              </span>
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  onPermanentDeleteChart(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-slate-100 text-xs font-bold transition-colors"
              >
                نعم، حذف نهائي
              </button>
            </div>
          </div>
        )}

        {/* Closed Charts List */}
        <div className="flex-1 overflow-y-auto min-h-0 rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/60">
          {closedCharts.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 space-y-2">
              <Archive className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
              <p>لا توجد شارتات مغلقة حالياً</p>
            </div>
          ) : (
            closedCharts.map((chart) => (
              <div
                key={chart.id}
                className="p-3 flex items-center justify-between hover:bg-slate-800/40 transition-colors gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 font-mono text-sm">{chart.symbol}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-emerald-400 border border-slate-700">
                      {chart.timeframe}
                    </span>
                    {chart.horizontalLines.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                        <Layers className="w-2.5 h-2.5" />
                        <span>{chart.horizontalLines.length} خطوط</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>أُغلق في: {formatClosedTime(chart.closedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onRestoreChart(chart.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    title="استعادة إلى الشارتات النشطة (مسموح حتى لو تجاوزت 10)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>استعادة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(chart.id)}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                    title="حذف نهائي"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Note about Restore bypassing 10-chart limit */}
        <div className="shrink-0 text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
          <span>* استعادة الشارت المغلق لا تخضع لحد الـ 10 شارتات.</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-emerald-400 hover:underline font-medium"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
