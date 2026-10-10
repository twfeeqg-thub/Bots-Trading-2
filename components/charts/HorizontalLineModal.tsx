// Project Q — Phase 4: Horizontal Line Editor Modal / Drawer
'use client';

import React, { useState } from 'react';
import { HorizontalLineConfig } from '@/lib/charts/chart-persistence';
import { X, Trash2, Check, Palette, Type, Sliders, Hash } from 'lucide-react';

interface HorizontalLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  line: HorizontalLineConfig | null;
  onSave: (updated: HorizontalLineConfig) => void;
  onDelete: (lineId: string) => void;
  currentPrice?: number | null;
}

const PRESET_COLORS = [
  '#10B981', // Emerald / Green
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#E2E8F0', // White / Slate
];

const PRESET_TEXT_COLORS = [
  '#FFFFFF',
  '#F8FAFC',
  '#E2E8F0',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#38BDF8',
];

const TEXT_SIZES = [10, 12, 14, 16] as const;
const LINE_WIDTHS = [1, 2, 3] as const;
const LINE_STYLES: { label: string; value: 'solid' | 'dashed' | 'dotted' }[] = [
  { label: 'متصل (Solid)', value: 'solid' },
  { label: 'متقطع (Dashed)', value: 'dashed' },
  { label: 'منقط (Dotted)', value: 'dotted' },
];

export function HorizontalLineModal({
  isOpen,
  onClose,
  line,
  onSave,
  onDelete,
  currentPrice,
}: HorizontalLineModalProps) {
  if (!isOpen || !line) return null;

  return (
    <HorizontalLineForm
      key={line.id}
      line={line}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
      currentPrice={currentPrice}
    />
  );
}

function HorizontalLineForm({
  line,
  onClose,
  onSave,
  onDelete,
  currentPrice,
}: {
  line: HorizontalLineConfig;
  onClose: () => void;
  onSave: (updated: HorizontalLineConfig) => void;
  onDelete: (lineId: string) => void;
  currentPrice?: number | null;
}) {
  const [label, setLabel] = useState<string>(line.label);
  const [priceStr, setPriceStr] = useState<string>(String(line.price));
  const [color, setColor] = useState<string>(line.color || '#10B981');
  const [textColor, setTextColor] = useState<string>(line.textColor || '#FFFFFF');
  const [textSize, setTextSize] = useState<number>(line.textSize || 12);
  const [lineWidth, setLineWidth] = useState<1 | 2 | 3>(line.lineWidth || 1);
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>(line.lineStyle || 'solid');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseFloat(priceStr);
    if (isNaN(parsedPrice) || parsedPrice <= 0) return;

    onSave({
      ...line,
      label: label.trim() || `مستوى ${parsedPrice}`,
      price: parsedPrice,
      color,
      textColor,
      textSize,
      lineWidth,
      lineStyle,
    });
    onClose();
  };

  const handleSetToCurrentPrice = () => {
    if (currentPrice && currentPrice > 0) {
      setPriceStr(String(currentPrice));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-5 text-slate-100 space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">تخصيص الخط الأفقي</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Label / Name */}
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-slate-400" />
              <span>اسم / نص الخط (Label):</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="مثال: دعم قوي، مقاومة 65K، هدف 1"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Price Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span>مستوى السعر (Price):</span>
              </label>
              {currentPrice && currentPrice > 0 && (
                <button
                  type="button"
                  onClick={handleSetToCurrentPrice}
                  className="text-[10px] text-emerald-400 hover:underline"
                >
                  استخدام السعر الحالي (${currentPrice})
                </button>
              )}
            </div>
            <input
              type="number"
              step="any"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder="أدخل السعر"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {/* Line Color */}
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-slate-400" />
              <span>لون الخط:</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                    color === c ? 'scale-110 ring-2 ring-emerald-400' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-3.5 h-3.5 text-slate-950" />}
                </button>
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                title="اختر لون مخصص"
              />
            </div>
          </div>

          {/* Text Color */}
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
              لون النص (Text Color):
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_TEXT_COLORS.map((tc) => (
                <button
                  key={tc}
                  type="button"
                  onClick={() => setTextColor(tc)}
                  className={`w-6 h-6 rounded-md transition-transform flex items-center justify-center border border-slate-700 ${
                    textColor === tc ? 'scale-110 ring-2 ring-emerald-400' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: tc }}
                >
                  {textColor === tc && <Check className="w-3 h-3 text-slate-950" />}
                </button>
              ))}
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                title="اختر لون نص مخصص"
              />
            </div>
          </div>

          {/* Text Size & Line Width */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                حجم النص:
              </label>
              <div className="grid grid-cols-4 gap-1">
                {TEXT_SIZES.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setTextSize(sz)}
                    className={`py-1 rounded text-center font-mono font-medium transition-colors ${
                      textSize === sz
                        ? 'bg-emerald-600 text-slate-950 font-bold'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                سماكة الخط:
              </label>
              <div className="grid grid-cols-3 gap-1">
                {LINE_WIDTHS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setLineWidth(w)}
                    className={`py-1 rounded text-center font-mono font-medium transition-colors ${
                      lineWidth === w
                        ? 'bg-emerald-600 text-slate-950 font-bold'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    {w}px
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Line Style */}
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
              نمط الخط (Line Style):
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {LINE_STYLES.map((st) => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => setLineStyle(st.value)}
                  className={`py-1.5 px-2 rounded text-center text-[11px] font-medium transition-colors ${
                    lineStyle === st.value
                      ? 'bg-emerald-600 text-slate-950 font-bold'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-500">معاينة:</span>
            <div className="flex-1 mx-3 border-t" style={{
              borderColor: color,
              borderWidth: `${lineWidth}px`,
              borderStyle: lineStyle === 'dashed' ? 'dashed' : lineStyle === 'dotted' ? 'dotted' : 'solid',
            }} />
            <span
              className="font-medium px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 shadow-sm"
              style={{ color: textColor, fontSize: `${textSize}px` }}
            >
              {label || 'المستوى'} (${priceStr || '0'})
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                onDelete(line.id);
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-medium flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف الخط</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
