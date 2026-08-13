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
import { approveScreenFirestore } from './lib/firebaseStore';
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

  // Poll general config from our Express backend API to stay synced across tabs/devices without active WebSockets
  useEffect(() => {
    const pollConfig = async () => {
      try {
        const resp = await fetch('/api/config');
        if (resp.ok) {
          const result = await resp.json();
          if (result.ok && result.config) {
            const data = result.config as TVConfig;
            setConfig((prev) => {
              if (JSON.stringify(prev) !== JSON.stringify(data)) {
                localStorage.setItem('android_tv_webview_config_v2', JSON.stringify(data));
                // IF there is a selectedGroupId in the synced config, let's update screenGroupId!
                if (data.selectedGroupId) {
                  setScreenGroupId(data.selectedGroupId);
                  localStorage.setItem('android_tv_webview_screen_group_id', data.selectedGroupId);
                } else {
                  // fallback
                  const fallbackId = data.screenGroups?.[0]?.id || '';
                  setScreenGroupId(fallbackId);
                  localStorage.setItem('android_tv_webview_screen_group_id', fallbackId);
                }
                return data;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        // Silently catch polling network errors
      }
    };

    pollConfig();
    const interval = setInterval(pollConfig, 10000); // Poll every 10 seconds (extremely light on backend)
    return () => clearInterval(interval);
  }, []);

  // Auto-fullscreen on first user interaction or mount
  useEffect(() => {
    const enterFullscreen = () => {
      if (!document.fullscreenElement) {
         if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
         }
      }
      window.removeEventListener('click', enterFullscreen);
      window.removeEventListener('keydown', enterFullscreen);
    };

    window.addEventListener('click', enterFullscreen);
    window.addEventListener('keydown', enterFullscreen);
    
    // Attempt immediate fullscreen
    enterFullscreen();

    return () => {
      window.removeEventListener('click', enterFullscreen);
      window.removeEventListener('keydown', enterFullscreen);
    };
  }, []);

  const osdTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Memory leak prevention: reload after 24 hours
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.reload();
    }, 24 * 60 * 60 * 1000);
    return () => clearTimeout(timer);
  }, []);

  // Device heartbeat effect: reports device presence & fetches assigned targeted config
  useEffect(() => {
    // Fetch config and approval status
    const performHeartbeat = async () => {
      try {
        const resp = await fetch('/api/screens/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenId,
            name: 'Màn Hình Sảnh A - Cửa Chính',
            groupId: screenGroupId,
            buildingId: config.selectedBuildingId,
            zone: config.selectedZone,
          }),
        });

        const contentType = resp.headers.get('content-type');
        if (resp.ok && contentType && contentType.includes('application/json')) {
          const data = await resp.json();
          if (data.ok) {
            if (data.approved !== undefined) {
              const isAppr = Boolean(data.approved);
              setIsDeviceApproved(isAppr);
              sessionStorage.setItem('android_tv_approved', isAppr ? 'true' : 'false');
              localStorage.setItem('android_tv_approved', isAppr ? 'true' : 'false');
            }

            const assignedBldId = data.buildingId;
            const assignedZone = data.zone;
            const assignedGroupId = data.groupId;
            const assigned = data.assignedConfig;

            if (assignedGroupId) {
              setScreenGroupId(assignedGroupId);
            }

            setConfig((prev) => {
              let changed = false;
              let updated = { ...prev };

              // 1. Sync assigned building & zone from server store
              if (
                (assignedBldId && assignedBldId !== prev.selectedBuildingId) ||
                (assignedZone && assignedZone !== prev.selectedZone)
              ) {
                const targetBldId = assignedBldId || prev.selectedBuildingId;
                const targetZone = assignedZone || prev.selectedZone;

                const bld = (prev.buildings || []).find((b) => b.id === targetBldId);
                if (bld) {
                  const zoneConfig = targetZone === 'cabin' ? bld.cabinConfig : bld.lobbyConfig;

                  updated.selectedBuildingId = targetBldId;
                  updated.selectedZone = targetZone;
                  updated.displayOrientation = zoneConfig.displayOrientation || prev.displayOrientation;
                  updated.organizationText = zoneConfig.organizationText || prev.organizationText;
                  updated.marqueeText = zoneConfig.marqueeText || prev.marqueeText;
                  updated.showMarquee = zoneConfig.showMarquee !== false;
                  updated.slideshowEnabled = zoneConfig.slideshowEnabled !== false;
                  updated.autoScrollEnabled = zoneConfig.autoScrollEnabled !== false;
                  updated.autoScrollSpeed = zoneConfig.autoScrollSpeed || 3;
                  updated.slides = JSON.parse(JSON.stringify(zoneConfig.slides || []));
                  changed = true;
                }
              }

              // 2. Override with broadcast config if present
              if (assigned && assigned.publishedAt) {
                if (
                  updated.marqueeText !== assigned.marqueeText ||
                  updated.organizationText !== assigned.organizationText ||
                  JSON.stringify(updated.slides) !== JSON.stringify(assigned.slides)
                ) {
                  updated = {
                    ...updated,
                    organizationText: assigned.organizationText || updated.organizationText,
                    marqueeText: assigned.marqueeText || updated.marqueeText,
                    slides: JSON.parse(JSON.stringify(assigned.slides || updated.slides)),
                  };
                  changed = true;
                }
              }

              if (changed) {
                localStorage.setItem('android_tv_webview_config_v2', JSON.stringify(updated));
                return updated;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        // Silently catch network errors
      }
    };

    performHeartbeat();
    // 3 seconds if not approved (very fast activation!), 8 seconds if approved (near real-time sync!)
    const interval = setInterval(performHeartbeat, isDeviceApproved ? 8000 : 3000);
    return () => clearInterval(interval);
  }, [screenId, screenGroupId, config.selectedBuildingId, config.selectedZone, isDeviceApproved]); 


  // Save config changes to localStorage & Firestore
  const handleSaveConfig = async (newConfig: TVConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem('android_tv_webview_config_v2', JSON.stringify(newConfig));
      const bldId = newConfig.selectedBuildingId;
      const zone = newConfig.selectedZone;
      const groupId = newConfig.selectedGroupId;
      if (groupId) {
        setScreenGroupId(groupId);
        localStorage.setItem('android_tv_webview_screen_group_id', groupId);
      } else {
        const defaultGroupId = newConfig.screenGroups?.[0]?.id || '';
        setScreenGroupId(defaultGroupId);
        localStorage.setItem('android_tv_webview_screen_group_id', defaultGroupId);
      }

      // Save directly to Express backend API which will persist locally to tv_config.json and asynchronously sync to Firestore
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: newConfig }),
      }).catch(err => console.error('Error saving config to API:', err));

      // Also publish to server store so heartbeats don't overwrite with stale assignedConfig
      await fetch('/api/screens/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: groupId ? 'groups' : 'all',
          targetGroupIds: groupId ? [groupId] : [],
          config: newConfig,
          title: 'Cập nhật cấu hình hệ thống',
          publisherEmail: 'system@admin.com',
          publisherName: 'Hệ thống',
        }),
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

