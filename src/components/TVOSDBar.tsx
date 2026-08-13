import React, { useEffect, useState } from 'react';
import {
  RotateCw,
  Settings,
  Maximize,
  Minimize,
  Tv,
  Lock,
  Wifi,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  ChevronUp
} from 'lucide-react';
import { TVConfig } from '../types';

interface TVOSDBarProps {
  config: TVConfig;
  onOpenSettings: () => void;
  onReload: () => void;
  onToggleFullscreen: () => void;
  onToggleBezel: () => void;
  onCloseOSD: () => void;
  pageTitle?: string;
  isIframeBlocked?: boolean;
  isPaused?: boolean;
  onTogglePause?: () => void;
  onNextSlide?: () => void;
  onPrevSlide?: () => void;
}

export const TVOSDBar: React.FC<TVOSDBarProps> = ({
  config,
  onOpenSettings,
  onReload,
  onToggleFullscreen,
  onToggleBezel,
  onCloseOSD,
  pageTitle,
  isIframeBlocked,
  isPaused,
  onTogglePause,
  onNextSlide,
  onPrevSlide,
}) => {
  const [time, setTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const timer = setInterval(() => setTime(new Date()), 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(timer);
    };
  }, []);

  const activeBuilding =
    config.buildings?.find((b) => b.id === config.selectedBuildingId) || config.buildings?.[0];
  const activeBuildingName = activeBuilding?.name || 'Tòa nhà A';
  const activeZoneLabel =
    config.selectedZone === 'cabin' ? '🛗 Cabin Thang' : '🏢 Sảnh Thang';

  // Prevent duplicated location text if organizationText already contains the building name/address
  const orgTextUpper = (config.organizationText || '').toUpperCase();
  const bldNameUpper = (activeBuildingName || '').toUpperCase();
  const bldCodeUpper = (activeBuilding?.code || '').toUpperCase();

  const isDuplicateLocation =
    (bldNameUpper.length > 3 && orgTextUpper.includes(bldNameUpper)) ||
    (orgTextUpper.length > 3 && bldNameUpper.includes(orgTextUpper)) ||
    (bldCodeUpper.length > 2 && orgTextUpper.includes(bldCodeUpper));

  const displayBadgeText = isDuplicateLocation
    ? activeZoneLabel
    : `📍 ${activeBuildingName} • ${activeZoneLabel}`;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 p-2 sm:p-4 transition-all duration-300 animate-in slide-in-from-top select-none max-w-full">
      <div className="max-w-7xl mx-auto bg-slate-950/95 border border-slate-700/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl backdrop-blur-2xl text-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 min-w-0">
        {/* Top/Left: App Brand & Building Location info */}
        <div className="flex items-center gap-3 min-w-0 flex-1 justify-between md:justify-start">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 sm:p-2.5 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-xl sm:rounded-2xl shadow-lg shadow-cyan-500/20 shrink-0">
              <Tv className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-cyan-400 whitespace-nowrap">
                  {config.organizationText || 'VĂN PHÒNG BỘ TÀI CHÍNH'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] sm:text-[11px] font-bold whitespace-nowrap">
                  {displayBadgeText}
                </span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap ${
                  isOnline 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}>
                  <Wifi className="w-3 h-3" /> {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80">
          {config.slideshowEnabled && onTogglePause && (
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl sm:rounded-2xl shrink-0">
              <button
                type="button"
                onClick={onPrevSlide}
                className="p-1.5 sm:p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg sm:rounded-xl transition-all cursor-pointer text-xs"
                title="Slide trước"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={onTogglePause}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-bold text-xs transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  isPaused
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
                title="Tạm dừng / Phát slideshow"
              >
                {isPaused ? 'Phát' : 'Tạm Dừng'}
              </button>
              <button
                type="button"
                onClick={onNextSlide}
                className="p-1.5 sm:p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg sm:rounded-xl transition-all cursor-pointer text-xs"
                title="Slide tiếp"
              >
                ›
              </button>
            </div>
          )}

          <button
            onClick={onReload}
            className="p-1.5 sm:p-2 bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white rounded-xl border border-slate-700/80 font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400"
            title="Tải lại trang (Phím R)"
          >
            <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 group-hover:text-white" />
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-300 whitespace-nowrap"
            title="Cài Đặt Hệ Thống"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Cài Đặt Hệ Thống</span>
            {config.kioskLock && <Lock className="w-3.5 h-3.5 text-amber-300 ml-0.5" />}
          </button>

          <button
            onClick={onToggleBezel}
            className={`p-1.5 sm:p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              config.showTvBezel
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Bật/tắt khung viền TV Bezel"
          >
            <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={onToggleFullscreen}
            className="p-1.5 sm:p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400"
            title="Toàn màn hình (Phím F)"
          >
            {config.isFullscreen ? (
              <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
            ) : (
              <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
            )}
          </button>

          <button
            onClick={onCloseOSD}
            className="p-1.5 sm:p-2 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all cursor-pointer"
            title="Ẩn thanh OSD"
          >
            <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
