import React, { useState, useEffect } from 'react';
import { Clock, CloudSun, Globe, Newspaper, Radio, Monitor, Sparkles, AlertCircle } from 'lucide-react';

interface BuiltInDashboardsProps {
  customUrl?: string;
  onOpenSettings: () => void;
  errorMessage?: string;
}

export const BuiltInDashboards: React.FC<BuiltInDashboardsProps> = ({
  customUrl,
  onOpenSettings,
  errorMessage
}) => {
  const [time, setTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'signage' | 'clock' | 'news'>('signage');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const formattedDate = time.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 flex flex-col justify-between p-8 relative overflow-hidden font-sans select-none">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner Notice if fallback */}
      {errorMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/20 border border-amber-500/40 text-amber-200 px-6 py-2 rounded-full text-sm flex items-center gap-2 backdrop-blur-md z-20 animate-pulse">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span>{errorMessage}</span>
          <button
            onClick={onOpenSettings}
            className="underline text-amber-300 font-semibold hover:text-amber-100 ml-2 cursor-pointer"
          >
            Đổi URL / Chế độ Proxy
          </button>
        </div>
      )}

      {/* TV Header */}
      <div className="flex items-center justify-between z-10 border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-2xl shadow-lg shadow-cyan-500/20">
            <Monitor className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Android TV Web Viewer
            </h1>
            <p className="text-sm text-slate-400">
              Đang tải: <span className="text-cyan-400 font-mono">{customUrl || 'Chưa thiết lập URL'}</span>
            </p>
          </div>
        </div>

        {/* Digital Clock */}
        <div className="text-right">
          <div className="text-4xl font-extrabold font-mono text-cyan-400 tracking-wider">
            {formattedTime}
          </div>
          <div className="text-sm text-slate-400 capitalize">{formattedDate}</div>
        </div>
      </div>

      {/* Main Display Matrix */}
      <div className="grid grid-cols-12 gap-6 my-auto z-10 py-6">
        {/* Left Column: Clock & Status */}
        <div className="col-span-8 bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl flex flex-col justify-between shadow-2xl relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> DIGITAL SIGNAGE DASHBOARD
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('signage')}
                className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'signage'
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Tổng quan
              </button>
              <button
                onClick={() => setActiveTab('clock')}
                className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'clock'
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Thời tiết & Giờ
              </button>
            </div>
          </div>

          <div className="my-8">
            <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 tracking-tight mb-2">
              Chế độ màn hình TV
            </div>
            <p className="text-lg text-slate-300 max-w-xl leading-relaxed">
              Ứng dụng đang phát trang web định sẵn trên Android TV. Sử dụng điều khiển từ xa (Remote D-Pad) hoặc nhấn phím <kbd className="px-2 py-1 bg-slate-800 rounded text-cyan-300 font-mono text-sm border border-slate-700">M</kbd> / <kbd className="px-2 py-1 bg-slate-800 rounded text-cyan-300 font-mono text-sm border border-slate-700">Menu</kbd> để mở Cài đặt.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-800">
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
              <div className="text-slate-400 text-xs mb-1 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-cyan-400" /> Trạng thái Mạng
              </div>
              <div className="text-emerald-400 font-semibold text-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Kết nối Hoạt động
              </div>
            </div>
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
              <div className="text-slate-400 text-xs mb-1 flex items-center gap-1.5">
                <CloudSun className="w-4 h-4 text-amber-400" /> Điều Kiện Hiển Thị
              </div>
              <div className="text-slate-200 font-semibold text-sm">Full HD 1080p 60Hz</div>
            </div>
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
              <div className="text-slate-400 text-xs mb-1 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-indigo-400" /> Remote Controller
              </div>
              <div className="text-indigo-300 font-semibold text-sm">Sẵn sàng (D-Pad)</div>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Action Cards */}
        <div className="col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
            <h3 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" /> Giờ Các Thành Phố
            </h3>
            <div className="space-y-3 mt-4">
              <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                <span className="text-slate-300 text-sm">Hà Nội / TP.HCM</span>
                <span className="text-cyan-400 font-mono font-bold">{formattedTime}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                <span className="text-slate-300 text-sm">Tokyo (UTC+9)</span>
                <span className="text-slate-200 font-mono font-bold">
                  {new Date(time.getTime() + 2 * 3600000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                <span className="text-slate-300 text-sm">London (UTC+1)</span>
                <span className="text-slate-200 font-mono font-bold">
                  {new Date(time.getTime() - 6 * 3600000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenSettings}
            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-cyan-500/20 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 text-base cursor-pointer"
          >
            <Monitor className="w-5 h-5" />
            Cấu hình Trang Web & URL
          </button>
        </div>
      </div>

      {/* Footer Instructions */}
      <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 text-xs text-slate-400 z-10">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <kbd className="px-2 py-0.5 bg-slate-800 text-slate-200 rounded font-mono">Phím M / Menu</kbd> Mở Cài Đặt
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-2 py-0.5 bg-slate-800 text-slate-200 rounded font-mono">Phím F</kbd> Toàn màn hình
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-2 py-0.5 bg-slate-800 text-slate-200 rounded font-mono">Phím R</kbd> Tải lại trang
          </span>
        </div>
        <div>
          Ứng dụng Android TV WebView v2.0 • Hỗ trợ Remote D-Pad
        </div>
      </div>
    </div>
  );
};
