import React, { useState } from 'react';
import { Monitor, Clock, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getSingleScreenFirestore } from '../lib/firebaseStore';

interface DeviceApprovalPendingProps {
  screenId: string;
  ipAddress?: string;
  onRefresh?: () => void;
  onApproved?: () => void;
  onOpenAdmin?: () => void;
}

export const DeviceApprovalPending: React.FC<DeviceApprovalPendingProps> = ({
  screenId,
  onApproved,
  onOpenAdmin,
}) => {
  const [copied, setCopied] = useState(false);
  const [currentTime] = useState(new Date());
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const handleManualCheck = async () => {
    setIsChecking(true);
    setCheckMessage('Đang kiểm tra kết nối với máy chủ...');
    try {
      const screenData = await getSingleScreenFirestore(screenId);
      
      if (screenData && screenData.approved === true) {
        setCheckMessage('🎉 Màn hình đã được phê duyệt! Đang chuyển hướng...');
        sessionStorage.setItem('android_tv_approved', 'true');
        localStorage.setItem('android_tv_approved', 'true');
        setTimeout(() => {
          if (onApproved) {
            onApproved();
          } else {
            window.location.reload();
          }
        }, 500);
      } else {
        setCheckMessage(`⏳ Màn hình ${screenId} chưa được phê duyệt. Vui lòng liên hệ Quản trị viên.`);
      }
    } catch (e) {
      setCheckMessage('❌ Không thể kết nối với máy chủ. Vui lòng kiểm tra lại mạng.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(screenId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white select-none overflow-y-auto py-8">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main container */}
      <div className="relative w-full max-w-2xl px-6 flex flex-col items-center text-center space-y-6">
        
        {/* Animated Radar Icon */}
        <div className="relative flex items-center justify-center w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-cyan-500/10 animate-ping opacity-75" />
          <div className="absolute inset-2 rounded-full bg-cyan-500/20 animate-pulse" />
          <div className="relative p-4 bg-slate-900 border border-slate-800 rounded-full text-cyan-400 shadow-xl shadow-cyan-500/10">
            <Monitor className="w-8 h-8" />
          </div>
        </div>

        {/* Header Text */}
        <div className="space-y-1.5">
          <span className="px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
            CHƯA ĐƯỢC KÍCH HOẠT
          </span>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight sm:text-3xl">
            Màn Hình Trình Chiếu Nội Dung
          </h1>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Thiết bị này cần được phê duyệt trước khi hiển thị nội dung. Sau khi Quản trị viên kích hoạt, vui lòng nhấn 'Kiểm Tra' để truy cập.
          </p>
        </div>

        {/* Activation Code Card */}
        <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md space-y-4">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-emerald-500 to-amber-500" />
          
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
              MÃ KÍCH HOẠT THIẾT BỊ (DEVICE ID)
            </span>
            
            <div className="mt-2 flex items-center justify-center gap-2 bg-slate-950 px-4 py-3 rounded-xl border border-slate-800">
              <span className="text-2xl font-mono font-extrabold text-cyan-400 tracking-wider select-all">
                {screenId}
              </span>
              
              <button
               type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                title="Sao chép mã"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
              QUÉT QR ĐỂ CHUYỂN ĐẾN TRANG QUẢN TRỊ
            </span>
            <div className="p-2 bg-white rounded-xl shadow-lg border border-slate-700">
              <QRCodeSVG value={`${window.location.origin}/?admin=true&approve=${screenId}`} size={120} />
            </div>
          </div>

          {checkMessage && (
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 font-medium animate-fade-in">
              {checkMessage}
            </div>
          )}

          {/* Action buttons grid */}
          <div className="pt-2 border-t border-slate-800/60 flex flex-col gap-2 w-full">
            <button
              type="button"
              onClick={handleManualCheck}
              disabled={isChecking}
              className="w-full px-3 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm cursor-pointer shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              {isChecking ? '⏳ Đang kiểm tra...' : '🔍 Kiểm Tra Trạng Thái'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenAdmin) {
                  onOpenAdmin();
                } else {
                  const url = new URL(window.location.href);
                  url.searchParams.set('admin', 'true');
                  window.location.href = url.toString();
                }
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs cursor-pointer border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
            >
              🛠️ Mở Trang Quản Trị Hệ Thống
            </button>
          </div>
        </div>

        {/* Footer Meta Infos */}
        <div className="flex flex-wrap justify-center items-center gap-4 text-slate-400 text-xs border-t border-slate-900 w-full max-w-md pt-3">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTime.toLocaleTimeString('vi-VN')}</span>
          </div>
        </div>

      </div>
    </div>
  );
};
