/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings } from 'lucide-react';
import { TVConfig, DPadDirection } from './types';
import { DEFAULT_CONFIG } from './data/presets';
import { ElevatorSignagePlayer } from './components/ElevatorSignagePlayer';
import { TVOSDBar } from './components/TVOSDBar';
import { TVSettingsModal } from './components/TVSettingsModal';
import { TVRemoteOverlay } from './components/TVRemoteOverlay';
import { DeviceApprovalPending } from './components/DeviceApprovalPending';
import {
  approveScreenFirestore,
  saveGlobalConfigFirestore,
  subscribeGlobalConfigFirestore,
  subscribeSingleScreenFirestore,
  logHistoryFirestore,
  
} from './lib/firebaseStore';
import './lib/firebaseDiagnostic';

export default function App() {
  const [config, setConfig] = useState<TVConfig>(() => {
    try {
      const saved = localStorage.getItem('android_tv_webview_config_v2');
      return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  });

  const [showOSD, setShowOSD] = useState(true);
  const [showSettings, setShowSettings] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const v = urlParams.get('view');
      const m = urlParams.get('mode');
      return v === 'admin' || m === 'admin' || urlParams.get('admin') === 'true';
    } catch {
      return false;
    }
  });
  const [reloadToken, setReloadToken] = useState(Date.now());
  const [isPaused, setIsPaused] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const osdTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sleep Mode Check
  useEffect(() => {
    if (!config.sleepMode?.enabled) {
      setIsSleeping(false);
      return;
    }

    const checkSleep = () => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const { startTime, endTime } = config.sleepMode;

      let isNowSleeping = false;
      if (startTime < endTime) {
        isNowSleeping = currentTime >= startTime && currentTime < endTime;
      } else {
        // Crosses midnight
        isNowSleeping = currentTime >= startTime || currentTime < endTime;
      }
      setIsSleeping(isNowSleeping);
    };

    checkSleep();
    const interval = setInterval(checkSleep, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [config.sleepMode]);

  const [screenGroupId, setScreenGroupId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('android_tv_webview_config_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedGroupId) {
          return parsed.selectedGroupId;
        }
        if (parsed.screenGroups && parsed.screenGroups[0]?.id) {
          return parsed.screenGroups[0].id;
        }
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_CONFIG.screenGroups?.[0]?.id || '';
  });

  const [screenId] = useState<string>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramScreenId = urlParams.get('screenId');
      if (paramScreenId) {
        const cleanParam = paramScreenId.trim().toUpperCase();
        sessionStorage.setItem('android_tv_screen_id', cleanParam);
        localStorage.setItem('android_tv_screen_id', cleanParam);
        return cleanParam;
      }
      if (urlParams.get('newDevice') === 'true' || urlParams.get('resetScreen') === 'true') {
        const freshId = 'SCR-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        sessionStorage.setItem('android_tv_screen_id', freshId);
        sessionStorage.setItem('android_tv_approved', 'false');
        return freshId;
      }
    } catch {
      // Ignore URL parsing errors
    }

    // Prefer sessionStorage for tab isolation (prevents admin tab and TV tab from colliding)
    let sid = sessionStorage.getItem('android_tv_screen_id') || localStorage.getItem('android_tv_screen_id');
    if (!sid) {
      sid = 'SCR-' + Math.random().toString(36).substring(2, 7).toUpperCase();
      sessionStorage.setItem('android_tv_screen_id', sid);
      localStorage.setItem('android_tv_screen_id', sid);
    } else {
      sessionStorage.setItem('android_tv_screen_id', sid);
    }
    return sid;
  });

  const [isDeviceApproved, setIsDeviceApproved] = useState<boolean>(() => {
    const sessionAppr = sessionStorage.getItem('android_tv_approved');
    if (sessionAppr !== null) {
      return sessionAppr === 'true';
    }
    const defaultApprovedIds = ['SCR-LOBBY-A1', 'SCR-LOBBY-A2', 'SCR-CABIN-A1', 'SCR-CABIN-A2', 'SCR-LOBBY-B1', 'SCR-CABIN-B1'];
    if (defaultApprovedIds.includes(screenId)) {
      return true;
    }
    return localStorage.getItem('android_tv_approved') === 'true';
  });

  // Auto-approve screen from URL parameter (e.g. when Admin scans QR code ?admin=true&approve=SCR-04NU9)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const approveParam = urlParams.get('approve');
      if (approveParam) {
        const cleanApproveId = approveParam.trim().toUpperCase().replace(/[\u2010-\u2015\u2212]/g, '-');
        
        // 1. Approve via Express API
        fetch('/api/screens/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenId: cleanApproveId,
            name: `Màn hình ${cleanApproveId}`,
            buildingId: 'building-a',
            zone: 'lobby',
          }),
        }).catch(() => {});

        // 2. Sync Firestore
        approveScreenFirestore(cleanApproveId, `Màn hình ${cleanApproveId}`, 'grp-8152', 'building-a', 'lobby').catch(() => {});

        // 3. If current screen is the target, approve immediately
        if (cleanApproveId.toLowerCase() === screenId.toLowerCase()) {
          setIsDeviceApproved(true);
          sessionStorage.setItem('android_tv_approved', 'true');
          localStorage.setItem('android_tv_approved', 'true');
        }

        // Open settings view so Admin can see the approved devices
        setShowSettings(true);

        // Remove approve param from URL without page reload
        const url = new URL(window.location.href);
        url.searchParams.delete('approve');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) {
      console.warn('Error handling URL approval:', e);
    }
  }, [screenId]);

  // Real-time config listener from Firestore: keeps all devices/tabs instantly synced on Vercel or local
  useEffect(() => {
    const unsubscribe = subscribeGlobalConfigFirestore((data) => {
      if (data && typeof data === 'object') {
        setConfig((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(data)) {
            localStorage.setItem('android_tv_webview_config_v2', JSON.stringify(data));
            if (data.selectedGroupId) {
              setScreenGroupId(data.selectedGroupId);
              localStorage.setItem('android_tv_webview_screen_group_id', data.selectedGroupId);
            } else if (data.screenGroups?.[0]?.id) {
              setScreenGroupId(data.screenGroups[0].id);
              localStorage.setItem('android_tv_webview_screen_group_id', data.screenGroups[0].id);
            }
            return data;
          }
          return prev;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time single screen approval listener from Firestore (1 read on connect, 0 continuous reads!)
  useEffect(() => {
    const unsubscribe = subscribeSingleScreenFirestore(screenId, (me) => {
      if (me) {
        if (me.approved !== undefined) {
          const isAppr = Boolean(me.approved);
          setIsDeviceApproved(isAppr);
          sessionStorage.setItem('android_tv_approved', isAppr ? 'true' : 'false');
          localStorage.setItem('android_tv_approved', isAppr ? 'true' : 'false');
        }
        if (me.groupId) {
          setScreenGroupId(me.groupId);
        }
      }
    });

    return () => unsubscribe();
  }, [screenId]);



  // Save config changes to localStorage & Firestore
  const handleSaveConfig = async (newConfig: TVConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem('android_tv_webview_config_v2', JSON.stringify(newConfig));
      const groupId = newConfig.selectedGroupId || newConfig.screenGroups?.[0]?.id || '';
      if (groupId) {
        setScreenGroupId(groupId);
        localStorage.setItem('android_tv_webview_screen_group_id', groupId);
      }

      // 1. Direct write to Firestore settings/tv_config_v2
      await saveGlobalConfigFirestore(newConfig);

      // 2. Non-blocking history logging
      logHistoryFirestore({
        id: 'pub-' + Date.now(),
        timestamp: new Date().toLocaleString('vi-VN'),
        title: 'Cập nhật cấu hình hệ thống',
        targetType: 'all',
        targetSummary: 'Cập nhật cấu hình hệ thống',
        affectedScreensCount: 1,
        publisherEmail: 'system@admin.com',
        publisherName: 'Hệ thống',
        configSnapshot: newConfig,
      }).catch(() => {});
    } catch (e) {
      console.error('Failed to save TV config:', e);
    }
    setReloadToken(Date.now());
  };

  // Resolve active building and zone config dynamically to ensure perfect alignment with player and prevent out-of-sync indexes
  const activeBuilding = (config.buildings || []).find((b) => b.id === config.selectedBuildingId) || config.buildings?.[0];
  const activeZoneConfig = activeBuilding
    ? (config.selectedZone === 'cabin' ? activeBuilding.cabinConfig : activeBuilding.lobbyConfig)
    : null;

  const currentSlidesSource = activeZoneConfig?.slides || config.slides || [];
  const targetedSlides = currentSlidesSource.filter((s) => {
    if (!s.enabled) return false;
    if (s.targetScope === 'groups') {
      return s.targetGroupIds && s.targetGroupIds.includes(screenGroupId);
    }
    return true;
  });

  const activeSlides = targetedSlides.length > 0
    ? targetedSlides
    : currentSlidesSource.filter((s) => s.enabled !== false);

  const slideshowEnabled = activeZoneConfig
    ? (activeZoneConfig.slideshowEnabled !== false && config.slideshowEnabled !== false)
    : config.slideshowEnabled;

  // Ensure currentSlideIndex stays within bounds when active slides list changes
  useEffect(() => {
    if (activeSlides.length > 0 && currentSlideIndex >= activeSlides.length) {
      setCurrentSlideIndex(0);
    }
  }, [activeSlides.length, currentSlideIndex]);

  const handleNextSlide = useCallback(() => {
    if (activeSlides.length > 0) {
      setCurrentSlideIndex((prev) => (prev + 1) % activeSlides.length);
    }
  }, [activeSlides.length]);

  const handlePrevSlide = useCallback(() => {
    if (activeSlides.length > 0) {
      setCurrentSlideIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
    }
  }, [activeSlides.length]);

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Auto-hide OSD after timeout
  const resetOSDTimer = useCallback(() => {
    setShowOSD(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    if (!showSettings) {
      osdTimerRef.current = setTimeout(() => {
        setShowOSD(false);
      }, 2500); // 2.5 seconds timeout
    }
  }, [showSettings]);

  useEffect(() => {
    resetOSDTimer();
    return () => {
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    };
  }, [resetOSDTimer]);

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    const newFsState = !config.isFullscreen;
    setConfig((prev) => {
      const updated = { ...prev, isFullscreen: newFsState };
      localStorage.setItem('android_tv_webview_config_v2', JSON.stringify(updated));
      return updated;
    });

    if (newFsState) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Handle D-Pad Remote Navigation
  const handleDPadAction = useCallback(
    (direction: DPadDirection) => {
      resetOSDTimer();

      switch (direction) {
        case 'MENU':
          setShowSettings((prev) => !prev);
          break;
        case 'REFRESH':
          setReloadToken(Date.now());
          break;
        case 'FULLSCREEN':
          handleToggleFullscreen();
          break;
        case 'PLAY_PAUSE':
          handleTogglePause();
          break;
        case 'LEFT':
          if (slideshowEnabled) {
            handlePrevSlide();
          } else {
            setShowOSD(true);
          }
          break;
        case 'RIGHT':
          if (slideshowEnabled) {
            handleNextSlide();
          } else {
            setShowOSD(true);
          }
          break;
        case 'SELECT':
          if (slideshowEnabled) {
            handleTogglePause();
          } else {
            setShowOSD(true);
          }
          break;
        case 'BACK':
          if (showSettings) {
            setShowSettings(false);
          } else if (showOSD) {
            setShowOSD(false);
          } else {
            setShowOSD(true);
          }
          break;
        case 'UP':
        case 'DOWN':
          setShowOSD(true);
          break;
        default:
          break;
      }
    },
    [resetOSDTimer, showSettings, showOSD, slideshowEnabled, handleNextSlide, handlePrevSlide, handleTogglePause]
  );

  // Global Keyboard listener for Android TV Remote keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          handleDPadAction('UP');
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleDPadAction('DOWN');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleDPadAction('LEFT');
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleDPadAction('RIGHT');
          break;
        case 'Enter':
          e.preventDefault();
          handleDPadAction('SELECT');
          break;
        case ' ':
          e.preventDefault();
          handleDPadAction('PLAY_PAUSE');
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          handleDPadAction('MENU');
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handleDPadAction('REFRESH');
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          handleDPadAction('FULLSCREEN');
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          handleDPadAction('BACK');
          break;
        default:
          resetOSDTimer();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDPadAction, resetOSDTimer]);

  const onApproved = useCallback(() => setIsDeviceApproved(true), []);
  const onOpenAdmin = useCallback(() => setShowSettings(true), []);

  if (!isDeviceApproved && !showSettings) {
    return (
      <DeviceApprovalPending
        screenId={screenId}
        onApproved={onApproved}
        onOpenAdmin={onOpenAdmin}
      />
    );
  }

  return (
    <div
      onMouseMove={(e) => {
        if (e.clientY < 60 || showOSD) {
          resetOSDTimer();
        }
      }}
      className="w-screen h-screen bg-slate-950 overflow-hidden font-sans select-none relative"
    >
      {/* Sleep Mode Overlay */}
      {isSleeping && <div className="fixed inset-0 z-[100] bg-black" />}

      {/* Main Display: Elevator Signage Player */}
      <ElevatorSignagePlayer
        config={config}
        onOpenSettings={() => setShowSettings(true)}
        reloadToken={reloadToken}
        isPaused={isPaused}
        onTogglePause={handleTogglePause}
        onNextSlide={handleNextSlide}
        onPrevSlide={handlePrevSlide}
        currentSlideIndex={currentSlideIndex}
        setCurrentSlideIndex={setCurrentSlideIndex}
        screenGroupId={screenGroupId}
      />

      {/* Top OSD Bar */}
      {showOSD && !showSettings && !config.kioskLock && (
        <TVOSDBar
          config={config}
          onOpenSettings={() => setShowSettings(true)}
          onReload={() => setReloadToken(Date.now())}
          onToggleFullscreen={handleToggleFullscreen}
          onToggleBezel={() =>
            handleSaveConfig({ ...config, showTvBezel: !config.showTvBezel })
          }
          onCloseOSD={() => setShowOSD(false)}
          isPaused={isPaused}
          onTogglePause={handleTogglePause}
          onNextSlide={handleNextSlide}
          onPrevSlide={handlePrevSlide}
        />
      )}

      {/* Settings & Slideshow Configuration Modal */}
      {showSettings && (
        <TVSettingsModal
          config={config}
          onSaveConfig={handleSaveConfig}
          onClose={() => setShowSettings(false)}
          screenId={screenId}
        />
      )}

      {/* Interactive On-screen Android TV Remote Widget */}
      {!config.kioskLock && (
        <TVRemoteOverlay
          onDirection={handleDPadAction}
          onOpenSettings={() => setShowSettings(true)}
          onToggleFullscreen={handleToggleFullscreen}
          onReload={() => setReloadToken(Date.now())}
          isFullscreen={config.isFullscreen}
        />
      )}

      {/* Subtle Settings Entry for Kiosk Mode */}
      {config.kioskLock && (
        <button
          onClick={() => setShowSettings(true)}
          className="fixed bottom-0 right-0 p-2 opacity-0 hover:opacity-100 transition-opacity z-50 cursor-pointer"
          title="Open Settings"
        >
          <Settings className="w-4 h-4 text-slate-500" />
        </button>
      )}
    </div>
  );
}

