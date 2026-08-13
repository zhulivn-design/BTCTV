import React, { useState, useEffect } from 'react';
import { Activity, Zap, Wifi, Clock, ShieldCheck } from 'lucide-react';
import { TVConfig } from '../types';

interface DashboardViewProps {
  config: TVConfig;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ config }) => {
  const [uptime, setUptime] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const interval = setInterval(() => {
      setUptime((prev) => prev + 1);
      setIsOnline(navigator.onLine);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-6 h-6 text-cyan-400" />
          <h3 className="font-bold text-slate-100">Thời gian chạy (Uptime)</h3>
        </div>
        <p className="text-3xl font-mono text-cyan-300">{formatTime(uptime)}</p>
      </div>

      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <Wifi className="w-6 h-6 text-cyan-400" />
          <h3 className="font-bold text-slate-100">Trạng thái mạng</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <p className="text-xl font-bold text-slate-100">{isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}</p>
        </div>
      </div>

      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-6 h-6 text-cyan-400" />
          <h3 className="font-bold text-slate-100">Phiên bản Ứng dụng</h3>
        </div>
        <p className="text-xl font-bold text-slate-100">v1.2.0</p>
      </div>
      
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl col-span-full">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-6 h-6 text-cyan-400" />
          <h3 className="font-bold text-slate-100">Cấu hình thiết bị</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-400">
           <div>Màn hình: {config.isFullscreen ? 'Full Screen' : 'Windowed'}</div>
           <div>Kiosk Lock: {config.kioskLock ? 'Bật' : 'Tắt'}</div>
           <div>Ngủ đêm: {config.sleepMode?.enabled ? `Bật (${config.sleepMode.startTime} - ${config.sleepMode.endTime})` : 'Tắt'}</div>
           <div>Auto Start: {config.autoStartOnBoot ? 'Bật' : 'Tắt'}</div>
        </div>
      </div>
    </div>
  );
};
