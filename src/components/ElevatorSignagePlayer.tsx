import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TVConfig, SlideItem, TransitionEffect, ScreenDevice } from '../types';
import { BuiltInDashboards } from './BuiltInDashboards';
import {
  Clock,
  ArrowUp,
  Volume2,
  Tv,
  Pause,
  Play,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Building2,
  Megaphone,
  Globe,
  Image as ImageIcon
} from 'lucide-react';

interface ElevatorSignagePlayerProps {
  config: TVConfig;
  screenData?: ScreenDevice | null;
  onOpenSettings: () => void;
  reloadToken: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onNextSlide: () => void;
  onPrevSlide: () => void;
  currentSlideIndex: number;
  setCurrentSlideIndex: (idx: number | ((prev: number) => number)) => void;
  screenGroupId?: string;
}

export const ElevatorSignagePlayer: React.FC<ElevatorSignagePlayerProps> = ({
  config,
  screenData,
  onOpenSettings,
  reloadToken,
  isPaused,
  onTogglePause,
  onNextSlide,
  onPrevSlide,
  currentSlideIndex,
  setCurrentSlideIndex,
  screenGroupId,
}) => {
  const [time, setTime] = useState(new Date());
  const [slideTimeRemaining, setSlideTimeRemaining] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check physical viewport aspect ratio
  const [isNaturallyPortrait, setIsNaturallyPortrait] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleResize = () => {
      setIsNaturallyPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Resolve Effective Building & Zone based on this screen's assigned properties
  const effectiveBuildingId = screenData?.buildingId || config.selectedBuildingId || config.buildings?.[0]?.id;
  const effectiveZone = screenData?.zone || config.selectedZone || 'lobby';
  const defaultGroupId = config.screenGroups?.[0]?.id || '';
  const activeGroupId = screenGroupId || screenData?.groupId || config.selectedGroupId || defaultGroupId;

  const activeBuilding = (config.buildings || []).find((b) => b.id === effectiveBuildingId) || config.buildings?.[0];
  const activeZoneConfig = activeBuilding
    ? (effectiveZone === 'cabin' ? activeBuilding.cabinConfig : activeBuilding.lobbyConfig)
    : null;

  // 2. Resolve Active Slides
  const currentSlidesSource = screenData?.assignedConfig?.slides && screenData.assignedConfig.slides.length > 0
    ? screenData.assignedConfig.slides
    : (activeZoneConfig?.slides || config.slides || []);

  const targetedSlides = currentSlidesSource.filter((s) => {
    if (!s.enabled) return false;
    if (s.targetScope === 'groups') {
      return s.targetGroupIds && s.targetGroupIds.includes(activeGroupId);
    }
    return true;
  });

  // Resilient fallback: If group-targeted filter yields 0 slides but zone has slides, use all enabled slides
  const activeSlides = targetedSlides.length > 0
    ? targetedSlides
    : currentSlidesSource.filter((s) => s.enabled !== false);

  // 3. Resolve Display Orientation (CRITICAL):
  const displayOrientation =
    screenData?.orientation ||
    (screenData?.resolution?.includes('9:16') ? '9:16' : undefined) ||
    (screenData?.resolution?.includes('4:3') ? '4:3' : undefined) ||
    (screenData?.zone === 'cabin' ? (activeZoneConfig?.displayOrientation || '9:16') : undefined) ||
    (screenData?.zone === 'lobby' ? (activeZoneConfig?.displayOrientation || '16:9') : undefined) ||
    activeZoneConfig?.displayOrientation ||
    config.displayOrientation ||
    '16:9';

  // 4. Resolve Header & Marquee Text
  const organizationText =
    screenData?.assignedConfig?.organizationText ||
    activeZoneConfig?.organizationText ||
    config.organizationText ||
    'BAN QUẢN LÝ / CÔNG TY • BẢNG THÔNG BÁO NỘI BỘ';

  const marqueeText =
    screenData?.assignedConfig?.marqueeText ||
    activeZoneConfig?.marqueeText ||
    config.marqueeText ||
    '';

  const showMarquee =
    screenData?.assignedConfig?.showMarquee !== undefined
      ? screenData.assignedConfig.showMarquee
      : (activeZoneConfig?.showMarquee !== false && config.showMarquee !== false);

  const autoScrollEnabled =
    screenData?.assignedConfig?.autoScrollEnabled !== undefined
      ? screenData.assignedConfig.autoScrollEnabled
      : (activeZoneConfig?.autoScrollEnabled !== false && config.autoScrollEnabled !== false);

  const autoScrollSpeed =
    screenData?.assignedConfig?.autoScrollSpeed ||
    activeZoneConfig?.autoScrollSpeed ||
    config.autoScrollSpeed ||
    3;

  const slideshowEnabled =
    screenData?.assignedConfig?.slideshowEnabled !== undefined
      ? screenData.assignedConfig.slideshowEnabled
      : (activeZoneConfig?.slideshowEnabled !== false && config.slideshowEnabled !== false);

  // Safe index bounds
  const safeSlideIndex =
    activeSlides.length > 0 ? currentSlideIndex % activeSlides.length : 0;

  // Fallback single slide if activeSlides is empty
  const currentSlide: SlideItem =
    activeSlides.length > 0 && activeSlides[safeSlideIndex]
      ? activeSlides[safeSlideIndex]
      : {
          id: 'fallback-web',
          type: 'web',
          title: 'Lịch Họp & Trang Web Mặc Định',
          url: 'https://vbdhbtc.mof.gov.vn/calendar.html',
          durationSeconds: config.defaultWebDurationSeconds || 30,
          transition: config.globalTransition || 'fade',
          enabled: true,
        };

  // Clock interval
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Slideshow auto-advance timer
  useEffect(() => {
    if (isPaused || !slideshowEnabled || activeSlides.length <= 1) {
      setSlideTimeRemaining(0);
      return;
    }

    const duration = currentSlide.durationSeconds || 10;
    let timeRemaining = duration;
    setSlideTimeRemaining(duration);

    const countdownInterval = setInterval(() => {
      timeRemaining -= 1;
      if (timeRemaining <= 0) {
        timeRemaining = duration;
        setSlideTimeRemaining(duration);
        setCurrentSlideIndex((old) => (old + 1) % activeSlides.length);
      } else {
        setSlideTimeRemaining(timeRemaining);
      }
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [
    currentSlideIndex,
    currentSlide.durationSeconds,
    isPaused,
    slideshowEnabled,
    activeSlides.length,
    setCurrentSlideIndex,
  ]);

  // Auto-scroll web page inside slideshow player if content extends below
  useEffect(() => {
    if (autoScrollEnabled === false || currentSlide.type !== 'web') return;

    const speed = autoScrollSpeed;
    const pixelsPerTick = Math.max(0.5, speed * 0.8);

    let isScrollPaused = false;
    let pauseTimer: NodeJS.Timeout | null = null;

    const interval = setInterval(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;

      try {
        const win = iframe.contentWindow;
        if (!win) return;

        const doc = win.document;
        const scrollTop = win.scrollY || doc.documentElement.scrollTop || doc.body.scrollTop || 0;
        const scrollHeight = doc.documentElement.scrollHeight || doc.body.scrollHeight || 0;
        const clientHeight = win.innerHeight || doc.documentElement.clientHeight || 0;

        if (scrollHeight > clientHeight + 15) {
          if (isScrollPaused) return;

          if (scrollTop + clientHeight >= scrollHeight - 10) {
            isScrollPaused = true;
            pauseTimer = setTimeout(() => {
              try {
                win.scrollTo({ top: 0, behavior: 'smooth' });
              } catch (e) {}
              pauseTimer = setTimeout(() => {
                isScrollPaused = false;
              }, 2000);
            }, 3000);
          } else {
            win.scrollBy(0, pixelsPerTick);
          }
        }
      } catch (err) {
        try {
          iframe.contentWindow?.scrollBy(0, pixelsPerTick);
        } catch (e) {}
      }
    }, 40);

    return () => {
      clearInterval(interval);
      if (pauseTimer) clearTimeout(pauseTimer);
    };
  }, [
    config.autoScrollEnabled,
    config.autoScrollSpeed,
    currentSlide.type,
    currentSlideIndex,
    reloadToken,
  ]);

  // Framer motion variants according to selected transition effect
  const getMotionVariants = (effect: TransitionEffect) => {
    switch (effect) {
      case 'slide-left':
        return {
          initial: { x: '100%', opacity: 0 },
          animate: { x: 0, opacity: 1 },
          exit: { x: '-100%', opacity: 0 },
        };
      case 'slide-right':
        return {
          initial: { x: '-100%', opacity: 0 },
          animate: { x: 0, opacity: 1 },
          exit: { x: '100%', opacity: 0 },
        };
      case 'slide-up':
        return {
          initial: { y: '100%', opacity: 0 },
          animate: { y: 0, opacity: 1 },
          exit: { y: '-100%', opacity: 0 },
        };
      case 'zoom-in':
        return {
          initial: { scale: 1.2, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 0.8, opacity: 0 },
        };
      case 'flip':
        return {
          initial: { rotateY: 90, opacity: 0 },
          animate: { rotateY: 0, opacity: 1 },
          exit: { rotateY: -90, opacity: 0 },
        };
      case 'blur':
        return {
          initial: { filter: 'blur(20px)', opacity: 0 },
          animate: { filter: 'blur(0px)', opacity: 1 },
          exit: { filter: 'blur(20px)', opacity: 0 },
        };
      case 'fade':
      default:
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        };
    }
  };

  const variants = getMotionVariants(currentSlide.transition || config.globalTransition);

  // Calculate Web Proxy URL
  const getWebSourceUrl = (webUrl: string) => {
    return config.proxyMode === 'proxy'
      ? `/api/proxy?url=${encodeURIComponent(webUrl)}`
      : webUrl;
  };

  // Orientation container styling
  const orientationStyle =
    displayOrientation === '9:16'
      ? (isNaturallyPortrait ? 'w-full h-full' : 'w-full max-w-[540px] h-[960px] max-h-[98vh] aspect-[9/16] my-auto shadow-2xl rounded-3xl border-4 border-slate-800')
      : displayOrientation === '4:3'
      ? 'w-full max-w-[1024px] aspect-[4/3] my-auto shadow-2xl rounded-2xl border-4 border-slate-800'
      : 'w-full h-full';

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center relative overflow-hidden select-none">
      <div className={`relative flex flex-col overflow-hidden bg-black ${orientationStyle}`}>
        {/* SIGNAGE HEADER BAR WITH LOGO */}
        {config.showHeader !== false && (
          <div className="bg-slate-900/95 border-b border-slate-800 text-slate-100 px-5 py-2.5 flex items-center justify-between z-20 backdrop-blur-md shrink-0 shadow-lg">
            {/* Left: Organization Logo & Title */}
            <div className="flex items-center gap-3 min-w-0">
              {config.showLogo !== false && (
                <div className="shrink-0 flex items-center justify-center">
                  {config.logoUrl ? (
                    <img
                      src={config.logoUrl}
                      alt="Logo"
                      className="h-9 max-w-[140px] object-contain rounded-md bg-white/10 p-0.5 border border-[#edf2f5]"
                      style={{ borderColor: '#edf2f5' }}
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 border border-cyan-400/30">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-extrabold tracking-wide text-white truncate uppercase font-mono">
                  {organizationText}
                </span>
                <span className="text-[10px] text-cyan-400 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  Bảng Thông Tin Điện Tử
                </span>
              </div>
            </div>

            {/* Right: Slide Status, Time & Date */}
            <div className="flex items-center gap-3 shrink-0 ml-2">
              {activeSlides.length > 1 && (
                <div className="hidden sm:flex items-center gap-2 bg-slate-950/80 px-3 py-1 rounded-full border border-slate-800 text-[11px] font-mono">
                  <span className="text-cyan-400 font-bold">
                    Slide {safeSlideIndex + 1}/{activeSlides.length}
                  </span>
                  {currentSlide.type === 'web' ? (
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  {!isPaused && slideTimeRemaining > 0 && (
                    <span className="text-slate-400 font-bold animate-pulse">
                      ({slideTimeRemaining}s)
                    </span>
                  )}
                </div>
              )}

              {/* Time & Weather */}
              <div className="text-right font-mono bg-slate-950/60 px-3 py-1 rounded-xl border border-slate-800/80">
                <div className="text-sm sm:text-base font-black text-cyan-300 leading-none">
                  {time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {time.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MAIN SLIDESHOW CONTENT DISPLAY */}
        <div className="relative flex-1 w-full h-full overflow-hidden bg-slate-950">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentSlide.id}-${safeSlideIndex}-${reloadToken}`}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="absolute inset-0 w-full h-full flex items-center justify-center"
            >
              {activeSlides.length === 0 ? (
                /* BEAUTIFUL PLACEHOLDER WHEN THERE ARE NO ACTIVE SLIDES */
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 border border-slate-800 p-6 text-center select-none">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 animate-pulse">
                    <Tv className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-100">Chưa Cấu Hình Slide Trình Chiếu</h3>
                  <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
                    Màn hình này hiện chưa có nội dung trình chiếu nào được kích hoạt. Hãy nhấn biểu tượng cài đặt trên điều khiển để thêm liên kết Trang Web hoặc Slide Ảnh.
                  </p>
                </div>
              ) : currentSlide.type === 'web' ? (
                /* WEB PAGE SLIDE (e.g. MEETING SCHEDULE, DASHBOARD) */
                <div className="w-full h-full overflow-hidden relative bg-slate-900">
                  <iframe
                    ref={iframeRef}
                    src={getWebSourceUrl(currentSlide.url)}
                    className="w-full h-full border-none transition-transform origin-top-left"
                    style={{
                      transform: `scale(${(currentSlide.customZoom || config.zoomLevel) / 100})`,
                      width: `${10000 / (currentSlide.customZoom || config.zoomLevel)}%`,
                      height: `${10000 / (currentSlide.customZoom || config.zoomLevel)}%`,
                    }}
                    title={currentSlide.title || 'Màn hình lịch họp'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    sandbox="allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                  />
                  {/* Subtle Web Slide Title Badge */}
                  <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-slate-700/80 text-[11px] text-slate-200 font-medium flex items-center gap-1.5 shadow-lg pointer-events-none">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{currentSlide.title}</span>
                  </div>
                </div>
              ) : (
                /* IMAGE SLIDE (ANNOUNCEMENTS, PROPAGANDA, NOTICES) */
                <div className="w-full h-full relative flex items-center justify-center bg-slate-950 overflow-hidden">
                  <img
                    src={currentSlide.url}
                    alt={currentSlide.title}
                    className={`w-full h-full transition-all duration-700 ${
                      currentSlide.fitMode === 'contain'
                        ? 'object-contain'
                        : currentSlide.fitMode === 'fill'
                        ? 'object-fill'
                        : 'object-cover'
                    }`}
                  />
                  {/* Image Announcement Caption Banner (Toggleable via config.showSlideCaption) */}
                  {config.showSlideCaption !== false && (currentSlide.title || currentSlide.caption) && (
                    <div className="absolute bottom-6 left-6 right-6 bg-slate-950/20 backdrop-blur-md border border-white/15 p-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
                      <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>{currentSlide.title}</span>
                      </h3>
                      {currentSlide.caption && (
                        <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                          {currentSlide.caption}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Quick Manual Navigation Controls Overlay */}
          {activeSlides.length > 1 && (
            <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between p-4 pointer-events-none z-10">
              <button
                onClick={onPrevSlide}
                className="p-3 bg-black/20 hover:bg-cyan-500/30 text-white/80 hover:text-white rounded-full border border-white/10 hover:border-cyan-400/30 shadow-2xl backdrop-blur-md transition-all pointer-events-auto transform hover:scale-110 cursor-pointer"
                title="Slide trước"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={onNextSlide}
                className="p-3 bg-black/20 hover:bg-cyan-500/30 text-white/80 hover:text-white rounded-full border border-white/10 hover:border-cyan-400/30 shadow-2xl backdrop-blur-md transition-all pointer-events-auto transform hover:scale-110 cursor-pointer"
                title="Slide tiếp theo"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>

        {/* BOTTOM MARQUEE TICKER */}
        {showMarquee && marqueeText && (
          <div className="bg-slate-950/95 border-t border-slate-800 px-4 py-2 flex items-center gap-3 overflow-hidden z-20 shrink-0 text-amber-300 font-semibold text-xs shadow-inner">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-lg shrink-0 font-bold">
              <Megaphone className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
              <span>THÔNG BÁO</span>
            </div>
            <div className="overflow-hidden whitespace-nowrap w-full">
              <div
                className="inline-block animate-marquee pl-full"
                style={{
                  animationDuration: `${Math.max(10, 40 - (config.marqueeSpeed || 3) * 6)}s`,
                }}
              >
                {marqueeText}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
