'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, MessageSquare } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeContext';

interface AssistantFloatingButtonProps {
  isOpen: boolean;
  onClick: () => void;
  activeProviderName?: string;
}

export function AssistantFloatingButton({
  isOpen,
  onClick,
  activeProviderName = 'Gemini',
}: AssistantFloatingButtonProps) {
  const { isLight } = useTheme();

  // Position state (null = use default CSS bottom-right position)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragInfoRef = useRef<{
    startX: number;
    startY: number;
    initLeft: number;
    initTop: number;
    hasMoved: boolean;
    pointerId: number | null;
  }>({
    startX: 0,
    startY: 0,
    initLeft: 0,
    initTop: 0,
    hasMoved: false,
    pointerId: null,
  });

  // Handle window resizing: clamp position within viewport
  useEffect(() => {
    const handleResize = () => {
      if (!position || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const padding = 12;
      const maxX = Math.max(padding, window.innerWidth - rect.width - padding);
      const maxY = Math.max(padding, window.innerHeight - rect.height - padding);

      setPosition(prev => {
        if (!prev) return null;
        return {
          x: Math.min(Math.max(padding, prev.x), maxX),
          y: Math.min(Math.max(padding, prev.y), maxY),
        };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

  // Pointer Down (Mouse / Touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    dragInfoRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initLeft: rect.left,
      initTop: rect.top,
      hasMoved: false,
      pointerId: e.pointerId,
    };

    setIsPressed(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }
  };

  // Pointer Move (Mouse / Touch)
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragInfoRef.current.pointerId !== e.pointerId) return;

    const dx = e.clientX - dragInfoRef.current.startX;
    const dy = e.clientY - dragInfoRef.current.startY;
    const distance = Math.hypot(dx, dy);

    // If movement exceeds small threshold, initiate dragging
    if (distance > 6 && !dragInfoRef.current.hasMoved) {
      dragInfoRef.current.hasMoved = true;
      setIsDragging(true);
    }

    if (dragInfoRef.current.hasMoved && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const padding = 12;
      const maxX = Math.max(padding, window.innerWidth - rect.width - padding);
      const maxY = Math.max(padding, window.innerHeight - rect.height - padding);

      const newX = Math.min(Math.max(padding, dragInfoRef.current.initLeft + dx), maxX);
      const newY = Math.min(Math.max(padding, dragInfoRef.current.initTop + dy), maxY);

      setPosition({ x: newX, y: newY });
    }
  };

  // Pointer Up / Cancel
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragInfoRef.current.pointerId !== e.pointerId) return;

    const hadMoved = dragInfoRef.current.hasMoved;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    dragInfoRef.current.pointerId = null;
    setIsPressed(false);
    setIsDragging(false);

    // If it was just a click (not dragged), trigger onClick
    if (!hadMoved) {
      onClick();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragInfoRef.current.pointerId === e.pointerId) {
      dragInfoRef.current.pointerId = null;
      setIsPressed(false);
      setIsDragging(false);
    }
  };

  // Determine tooltip orientation based on position
  const isNearLeftEdge = position !== null && position.x < 180;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              right: 'auto',
              bottom: 'auto',
              touchAction: 'none',
            }
          : {
              touchAction: 'none',
            }
      }
      className={`fixed ${
        position ? '' : 'bottom-20 md:bottom-6 right-4 md:right-6'
      } z-40 flex items-center gap-2 group select-none cursor-grab ${
        isDragging ? 'cursor-grabbing scale-105 z-50' : ''
      }`}
    >
      {/* Tooltip on Desktop hover (adjusted if near left edge) */}
      <div
        className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs shadow-lg transition-all duration-200 pointer-events-none ${
          isDragging ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
        } ${isNearLeftEdge ? 'order-last' : 'order-first'} ${
          isLight
            ? 'bg-white/95 border-slate-200 text-slate-800 backdrop-blur-md'
            : 'bg-slate-900/95 border-slate-700 text-slate-200 backdrop-blur-md'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
        <span className="font-medium">المساعد الذكي ({activeProviderName})</span>
        <span className="text-[10px] text-slate-400 mr-1 border-r border-slate-700 pr-1">اسحب للتحريك</span>
      </div>

      {/* Floating Action Button */}
      <button
        type="button"
        aria-label="المساعد الذكي لتحليل الأسواق والعملات (قابل للتحريك)"
        className={`relative w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 transform border pointer-events-none ${
          isDragging
            ? 'scale-110 shadow-emerald-500/50 ring-4 ring-emerald-400/50'
            : isPressed
            ? 'scale-95'
            : 'hover:scale-105'
        } ${
          isOpen
            ? 'bg-emerald-600 text-white border-emerald-400 rotate-90 shadow-emerald-500/30 ring-4 ring-emerald-500/20'
            : isLight
            ? 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-600/25 ring-2 ring-emerald-400/20'
            : 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-emerald-500/30 ring-2 ring-emerald-400/30'
        }`}
      >
        {/* Glow pulse ring when idle */}
        {!isOpen && !isDragging && (
          <span className="absolute -inset-1 rounded-full bg-emerald-500/30 animate-ping opacity-60 pointer-events-none duration-1000" />
        )}

        {isOpen ? (
          <MessageSquare className="w-6 h-6" />
        ) : (
          <div className="relative">
            <Bot className="w-6 h-6 md:w-7 md:h-7" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-emerald-950"></span>
            </span>
          </div>
        )}
      </button>
    </div>
  );
}
