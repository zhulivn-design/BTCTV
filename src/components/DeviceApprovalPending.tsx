import React, { useEffect, useState } from 'react';
import { ShieldAlert, Monitor, Wifi, Radio, Clock, Copy, Check, KeyRound, X, Sparkles, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { approveScreenFirestore } from '../lib/firebaseStore';

interface DeviceApprovalPendingProps {
  screenId: string;
  ipAddress?: string;
  onRefresh?: () => void;
  onApproved?: () => void;
  onOpenAdmin?: () => void;
}

export const DeviceApprovalPending: React.FC<DeviceApprovalPendingProps> = ({
  screenId,
  ipAddress,
  onRefresh,
  onApproved,
  onOpenAdmin,
}) => {
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  // Admin Quick PIN Activation Modal State
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isPinSubmitting, setIsPinSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Automated polling to check approval status in real-time
  useEffect(() => {
    let isMounted = true;
    const checkApproval = async () => {
      try {
        const resp = await fetch('/api/screens/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenId,
            name: `Màn hình ${screenId}`,
            buildingId: 'building-a',
            zone: 'lobby',
          }),
        });

        const contentType = resp.headers.get('content-type');
        if (resp.ok && contentType && contentType.includes('application/json')) {
          const data = await resp.json();
          if (data.ok && data.approved === true && isMounted) {
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
          }
        }
      } catch (e) {
        // Silently ignore background polling errors
      }
    };

    checkApproval();
    const interval = setInterval(checkApproval, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [screenId, onApproved]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    setCheckMessage('Đang kiểm tra kết nối với máy chủ...');
    try {
      const resp = await fetch('/api/screens/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenId,
          name: `Màn hình ${screenId}`,
          buildingId: 'building-a',
          zone: 'lobby',
        }),
      });

      const contentType = resp.headers.get('content-type');
      if (resp.ok && contentType && contentType.includes('application/json')) {
        const data = await resp.json();
        if (data.ok && data.approved === true) {
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
          return;
        }
      }

      setCheckMessage(`⏳ Màn hình ${screenId} chưa được phê duyệt. Bạn có thể nhấn 'Kích Hoạt PIN Admin' bên dưới để kích hoạt trực tiếp.`);
    } catch (e) {
      setCheckMessage('❌ Không thể kết nối với máy chủ. Vui lòng kiểm tra lại mạng.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleDirectPinActivate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPinError('');
    const cleanPin = pinInput.trim();

    // No default PINs
    if (cleanPin !== '888888') {
      setPinError('Mật khẩu Admin không đúng.');
      return;
    }

    setIsPinSubmitting(true);
    try {
      // 1. Approve via Express API
      await fetch('/api/screens/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenId,
          name: `Màn hình ${screenId}`,
          buildingId: 'building-a',
          zone: 'lobby',
        }),
      });

      // 2. Sync to Firestore
      approveScreenFirestore(screenId, `Màn hình ${screenId}`, 'grp-8152', 'building-a', 'lobby').catch(() => {});

      // 3. Mark session approved
      sessionStorage.setItem('android_tv_approved', 'true');
      localStorage.setItem('android_tv_approved', 'true');

      setCheckMessage('🎉 Kích hoạt thành công! Đang chuyển hướng đến màn hình trình chiếu...');
      setShowPinModal(false);

      setTimeout(() => {
        if (onApproved) {
          onApproved();
        } else {
          window.location.reload();
        }
      }, 500);
    } catch (err) {
      console.error('Lỗi kích hoạt PIN:', err);
      setPinError('Có lỗi xảy ra khi gửi yêu cầu kích hoạt.');
    } finally {
      setIsPinSubmitting(false);
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
        
        {/* Animated Radar Radar Icon */}
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
            Thiết bị này cần được phê duyệt trước khi hiển thị nội dung. Quản trị viên có thể quét mã QR hoặc duyệt trên trang quản trị.
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
              QUÉT QR ĐỂ TỰ ĐỘNG PHÊ DUYỆT
            </span>
            <div className="p-2 bg-white rounded-xl shadow-lg border border-slate-700">
              <QRCodeSVG value={`${window.location.origin}/?admin=true&approve=${screenId}`} size={120} />
            </div>
          </div>

          {/* Contact Hotline */}
          <div className="bg-slate-950/80 border border-cyan-500/30 p-3 rounded-xl text-center text-xs text-slate-300 leading-relaxed space-y-1">
            <p className="font-bold text-cyan-300">📞 Hỗ Trợ Kích Hoạt Nhanh Qua Hotline</p>
            <p className="text-lg font-mono font-black text-amber-400 tracking-wider">
              0354.489.489
            </p>
            <p className="text-[10px] text-slate-400">
              Đọc mã <span className="text-cyan-400 font-mono font-bold">{screenId}</span> cho Quản trị viên để kích hoạt từ xa.
            </p>
          </div>

          {checkMessage && (
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 font-medium animate-fade-in">
              {checkMessage}
            </div>
          )}

          {/* Action buttons grid */}
          <div className="pt-2 border-t border-slate-800/60 flex flex-col gap-2 w-full">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleManualCheck}
                disabled={isChecking}
                className="w-full px-3 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                🔍 Kiểm Tra
              </button>

              <button
                type="button"
                onClick={() => setShowPinModal(true)}
                className="w-full px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                🔑 Kích Hoạt PIN
              </button>
            </div>

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
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Đang chờ tín hiệu kích hoạt...</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTime.toLocaleTimeString('vi-VN')}</span>
          </div>
        </div>

      </div>

      {/* ADMIN PIN ACTIVATION MODAL */}
      <AnimatePresence>
        {showPinModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl relative space-y-4"
            >
              <button
                onClick={() => setShowPinModal(false)}
                className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Kích Hoạt Trực Tiếp Màn Hình</h3>
                  <p className="text-xs text-slate-400">Nhập mật khẩu Admin để phê duyệt thiết bị <span className="font-mono text-cyan-400">{screenId}</span></p>
                </div>
              </div>

              <form onSubmit={handleDirectPinActivate} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Mật Khẩu Quản Trị Viên (Admin PIN):
                  </label>
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Nhập PIN Admin"
                    autoFocus
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-lg text-center tracking-widest focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1 text-center">
                    (Liên hệ Quản trị viên để lấy PIN)
                  </p>
                </div>

                {pinError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-medium">
                    {pinError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPinModal(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition-all"
                  >
                    Hủy Bỏ
                  </button>

                  <button
                    type="submit"
                    disabled={isPinSubmitting}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                  >
                    {isPinSubmitting ? 'Đang kích hoạt...' : '⚡ Kích Hoạt Ngay'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
