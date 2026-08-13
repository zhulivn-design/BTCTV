import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Maximize2,
  Settings,
  Tv,
  Home,
  X,
  SlidersHorizontal,
  CircleDot
} from 'lucide-react';
import { DPadDirection } from '../types';

interface TVRemoteOverlayProps {
  onDirection: (dir: DPadDirection) => void;
  onOpenSettings: () => void;
  onToggleFullscreen: () => void;
  onReload: () => void;
  isFullscreen: boolean;
}

export const TVRemoteOverlay: React.FC<TVRemoteOverlayProps> = ({
  onDirection,
  onOpenSettings,
  onToggleFullscreen,
  onReload,
  isFullscreen,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 px-4 py-3 bg-slate-900/90 hover:bg-cyan-600 text-cyan-300 hover:text-white rounded-2xl border border-cyan-500/40 shadow-2xl backdrop-blur-xl transition-all transform hover:scale-105 group cursor-pointer"
          title="Mở Remote Điều Khiển Từ Xa TV"
        >
          <Tv className="w-5 h-5 text-cyan-400 group-hover:text-white animate-pulse" />
          <span className="text-xs font-bold font-mono">ĐIỀU KHIỂN</span>
          <SlidersHorizontal className="w-4 h-4 opacity-70" />
        </button>
      ) : (
        <div className="bg-slate-950/95 border border-slate-700/80 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl w-64 text-slate-100 animate-in fade-in zoom-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-extrabold tracking-wider text-cyan-300 font-mono">
                BTC Digital Signage
              </span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* D-Pad Controller Wheel */}
          <div className="relative w-44 h-44 mx-auto my-2 bg-slate-900 rounded-full border border-slate-800 p-2 shadow-inner flex items-center justify-center">
            {/* Top / Up */}
            <button
              onClick={() => onDirection('UP')}
              className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-10 bg-slate-800 hover:bg-cyan-500 text-slate-300 hover:text-white rounded-t-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all cursor-pointer shadow"
              title="Lên (Up Arrow)"
            >
              <ChevronUp className="w-5 h-5" />
            </button>

            {/* Bottom / Down */}
            <button
              onClick={() => onDirection('DOWN')}
              className="absolute bottom-1 left-1/2 -translate-x-1/2 w-12 h-10 bg-slate-800 hover:bg-cyan-500 text-slate-300 hover:text-white rounded-b-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all cursor-pointer shadow"
              title="Xuống (Down Arrow)"
            >
              <ChevronDown className="w-5 h-5" />
            </button>

            {/* Left */}
            <button
              onClick={() => onDirection('LEFT')}
              className="absolute left-1 top-1/2 -translate-y-1/2 w-10 h-12 bg-slate-800 hover:bg-cyan-500 text-slate-300 hover:text-white rounded-l-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all cursor-pointer shadow"
              title="Trái (Left Arrow)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Right */}
            <button
              onClick={() => onDirection('RIGHT')}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-12 bg-slate-800 hover:bg-cyan-500 text-slate-300 hover:text-white rounded-r-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all cursor-pointer shadow"
              title="Phải (Right Arrow)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Center OK / Select Button */}
            <button
              onClick={() => onDirection('SELECT')}
              className="w-14 h-14 bg-gradient-to-tr from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-full font-bold text-sm shadow-lg shadow-cyan-500/30 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-cyan-300 active:scale-95 transition-all cursor-pointer"
              title="Chọn / OK (Enter)"
            >
              <CircleDot className="w-6 h-6" />
            </button>
          </div>

          {/* Quick TV Control Row */}
          <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-800">
            <button
              onClick={() => onDirection('MENU')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
              title="Menu Cài Đặt (Phím M)"
            >
              <Settings className="w-4 h-4" />
              <span>Menu</span>
            </button>

            <button
              onClick={onReload}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
              title="Tải Lại (Phím R)"
            >
              <RotateCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>

            <button
              onClick={onToggleFullscreen}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
              title="Toàn Màn Hình (Phím F)"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Full</span>
            </button>

            <button
              onClick={() => onDirection('BACK')}
              className="p-2.5 bg-slate-800 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
              title="Quay Lại (Phím Backspace / Esc)"
            >
              <Home className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>

          {/* Keyboard shortcut legend */}
          <div className="mt-3 text-[10px] text-slate-400 text-center font-mono bg-slate-900/80 p-2 rounded-xl border border-slate-800">
            D-Pad: <span className="text-cyan-300">Mũi tên</span> | OK: <span className="text-cyan-300">Enter</span> | Menu: <span className="text-cyan-300">M</span>
          </div>

          {/* Technical Support/Creator branding info */}
          <div className="mt-2.5 pt-2 border-t border-slate-900 text-center text-[10px] text-slate-500 flex flex-col gap-0.5">
            <div>Tác giả: <span className="text-slate-300 font-semibold">Nguyễn Sơn</span></div>
            <div>Hỗ trợ kỹ thuật: <span className="text-cyan-400 font-bold">1999</span></div>
          </div>
        </div>
      )}
    </div>
  );
};
