import React, { useState, useEffect } from 'react';
import { Activity, Zap, Wifi, Clock, ShieldCheck, Monitor, RefreshCw, Layers, ExternalLink, CheckCircle2 } from 'lucide-react';
import { TVConfig, ScreenDevice } from '../types';
import { subscribeScreensFirestore, fetchFirestoreState } from '../lib/firebaseStore';

interface DashboardViewProps {
  config: TVConfig;
  screenId?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ config, screenId }) => {
  const [uptime, setUptime] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [screens, setScreens] = useState<ScreenDevice[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const effectiveScreenId = screenId || 
    (typeof window !== 'undefined' ? (sessionStorage.getItem('android_tv_screen_id') || localStorage.getItem('android_tv_screen_id')) : '') || 
    'SCR-LOBBY-A1';

  const matchedScreen = screens.find((s) => s.id?.toUpperCase() === effectiveScreenId.toUpperCase());
  const thisDeviceName = matchedScreen?.name || `Màn hình ${effectiveScreenId}`;

  // Load & subscribe to screens real-time
  useEffect(() => {
    const loadScreens = async () => {
      try {
        const state = await fetchFirestoreState();
        if (state && state.screens && state.screens.length > 0) {
          setScreens(state.screens);
        } else {
          const resp = await fetch('/api/screens/state');
          if (resp.ok) {
            const data = await resp.json();
            if (data && data.screens) {
              setScreens(data.screens);
            }
          }
        }
      } catch (err) {
        console.warn('DashboardView load screens error:', err);
      }
    };
    loadScreens();

    const unsubscribe = subscribeScreensFirestore((remoteScreens) => {
      if (Array.isArray(remoteScreens)) {
        setScreens(remoteScreens);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setUptime((prev) => prev + 1);
      setIsOnline(navigator.onLine);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const state = await fetchFirestoreState();
      if (state && state.screens) {
        setScreens(state.screens);
      }
      setIsOnline(navigator.onLine);
    } catch (e) {
      console.warn('Manual refresh error:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine online screens (status is online or lastSeen within 2 mins)
  const now = Date.now();
  const onlineScreens = screens.filter(
    (s) => s.status === 'online' || (s.lastSeen && now - s.lastSeen < 120000)
  );

  return (
    <div className="space-y-6">
      {/* 4 Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Uptime */}
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Thời gian chạy (Uptime)</h3>
              <p className="text-[11px] text-slate-400">Phiên làm việc hiện tại</p>
            </div>
          </div>
          <p className="text-3xl font-mono font-bold text-cyan-300 tracking-wider">{formatTime(uptime)}</p>
        </div>

        {/* Card 2: Network Status & Current Device (Yêu cầu 1) */}
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-cyan-500/30 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Trạng thái mạng</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                  <span className={`text-xs font-bold ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Làm mới kết nối"
              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Thiết bị này:</span>
              <span className="font-mono font-bold text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60">
                {effectiveScreenId}
              </span>
            </div>
            <div className="text-xs font-bold text-white truncate" title={thisDeviceName}>
              {thisDeviceName}
            </div>
          </div>
        </div>

        {/* Card 3: Online Screens Count */}
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Màn hình Trực tuyến</h3>
              <p className="text-[11px] text-slate-400">Đang kết nối hệ thống</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-mono font-bold text-emerald-400">
              {onlineScreens.length > 0 ? onlineScreens.length : (isOnline ? 1 : 0)}
            </p>
            <span className="text-sm font-semibold text-slate-400">
              / {screens.length > 0 ? screens.length : 1} màn hình
            </span>
          </div>
        </div>

        {/* Card 4: Version & Cloud DB */}
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Phiên bản Ứng dụng</h3>
              <p className="text-[11px] text-slate-400">Cloud Firestore Realtime</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-slate-100">v1.2.0</p>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Đồng bộ Đám mây
            </span>
          </div>
        </div>
      </div>

      {/* SECTION: Live Online Screens List (Yêu cầu 1: trực tuyến là màn hình nào trực tuyến, hiển thị tên và mã thiết bị) */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-600/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                Danh Sách Màn Hình Trực Tuyến & Hoạt Động
                <span className="px-2.5 py-0.5 bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 rounded-full text-xs font-mono font-bold">
                  {onlineScreens.length > 0 ? onlineScreens.length : (isOnline ? 1 : 0)} Đang Online
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Chi tiết tên màn hình, mã thiết bị và trạng thái kết nối thực tế trong mạng
              </p>
            </div>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Làm Mới Trạng Thái</span>
          </button>
        </div>

        {/* Screens Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {screens.length === 0 ? (
            // Fallback display if no screens registered in DB yet
            <div className="p-4 bg-slate-950/80 border border-emerald-500/40 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Trực Tuyến (Online)
                </span>
                <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-800 px-2 py-0.5 rounded-full">
                  Thiết Bị Này
                </span>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">Tên màn hình:</div>
                <div className="text-sm font-bold text-white">{thisDeviceName}</div>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">Mã thiết bị:</span>
                <span className="font-mono font-bold text-cyan-300">{effectiveScreenId}</span>
              </div>
            </div>
          ) : (
            screens.map((scr) => {
              const isThisDevice = scr.id?.toUpperCase() === effectiveScreenId.toUpperCase();
              const isScrOnline = scr.status === 'online' || (scr.lastSeen && now - scr.lastSeen < 120000);
              const groupName = config.screenGroups?.find((g) => g.id === scr.groupId)?.name || scr.groupName || scr.groupId;

              return (
                <div
                  key={scr.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                    isThisDevice
                      ? 'bg-gradient-to-br from-slate-950 to-cyan-950/30 border-cyan-500/50 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500/30'
                      : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  {/* Status Badge & This device badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                        isScrOnline
                          ? 'text-emerald-400 bg-emerald-950/80 border border-emerald-800/80'
                          : 'text-slate-400 bg-slate-900 border border-slate-800'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isScrOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                        }`}
                      />
                      {isScrOnline ? 'Trực Tuyến' : 'Ngoại Tuyến'}
                    </span>

                    {isThisDevice && (
                      <span className="text-[10px] font-extrabold text-cyan-300 bg-cyan-950/90 border border-cyan-700/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                        Thiết Bị Này
                      </span>
                    )}
                  </div>

                  {/* Device Info */}
                  <div className="space-y-1">
                    <div className="text-[11px] text-slate-400 font-medium">Tên màn hình:</div>
                    <div className="text-sm font-bold text-white line-clamp-1" title={scr.name || scr.id}>
                      {scr.name || `Màn hình ${scr.id}`}
                    </div>
                  </div>

                  {/* Metadata: Code & Zone */}
                  <div className="space-y-1.5 text-xs pt-2 border-t border-slate-850 bg-slate-900/40 -mx-4 -mb-4 p-3 rounded-b-2xl">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Mã thiết bị:</span>
                      <span className="font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/50">
                        {scr.id}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Vị trí:</span>
                      <span className="text-slate-300 font-semibold">
                        {scr.zone === 'cabin' ? '🛗 Cabin (9:16)' : '🏢 Sảnh thang (16:9)'}
                      </span>
                    </div>

                    {groupName && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Nhóm:</span>
                        <span className="text-purple-300 font-medium truncate max-w-[150px]" title={groupName}>
                          {groupName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SECTION: Device Hardware & Runtime Configuration */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base">Cấu Hình Thiết Bị & Khóa Kiosk</h3>
            <p className="text-xs text-slate-400">Các tham số vận hành phần cứng trên Android TV / Kiosk</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1">
            <div className="text-slate-400">Chế độ hiển thị:</div>
            <div className="font-bold text-white">{config.isFullscreen ? 'Toàn Màn Hình' : 'Cửa Sổ'}</div>
          </div>
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1">
            <div className="text-slate-400">Khóa Kiosk (PIN):</div>
            <div className="font-bold text-white">{config.kioskLock ? 'Đang Bật' : 'Tắt'}</div>
          </div>
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1">
            <div className="text-slate-400">Chế độ ngủ đêm:</div>
            <div className="font-bold text-white">
              {config.sleepMode?.enabled ? `Bật (${config.sleepMode.startTime} - ${config.sleepMode.endTime})` : 'Tắt'}
            </div>
          </div>
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1">
            <div className="text-slate-400">Tự động khởi động:</div>
            <div className="font-bold text-white">{config.autoStartOnBoot ? 'Bật Cùng Hệ Thống' : 'Tắt'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

