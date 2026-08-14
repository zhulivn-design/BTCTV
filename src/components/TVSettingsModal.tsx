import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';
import {
  X,
  Globe,
  Save,
  RotateCw,
  Lock,
  Unlock,
  Key,
  Keyboard,
  Monitor,
  ShieldAlert,
  Sparkles,
  Zap,
  Tv,
  Layers,
  Building2,
  Megaphone,
  Sliders,
  ChevronsDown,
  User,
  Mail,
  LogOut,
  ShieldCheck,
  Check,
  Activity,
  HelpCircle,
  PhoneCall,
  Database,
  Image as ImageIcon
} from 'lucide-react';
import { TVConfig, SlideItem, DisplayOrientation, LocationZone, PublishHistoryItem } from '../types';
import { TVVirtualKeyboard } from './TVVirtualKeyboard';
import { ImageSlideshowManager } from './ImageSlideshowManager';
import { BuildingManager } from './BuildingManager';
import { ScreenGroupManager } from './ScreenGroupManager';
import { DashboardView } from './DashboardView';
import { FirestoreLogsView } from './FirestoreLogsView';
import { FirebaseDiagnosticPanel } from './FirebaseDiagnosticPanel';
import {
  logHistoryFirestore,
  getFirestoreUser,
  updateFirestoreUserPassword,
  fetchFirestoreState,
  subscribeGroupsFirestore,
  subscribeGlobalConfigFirestore,
} from '../lib/firebaseStore';

interface TVSettingsModalProps {
  config: TVConfig;
  onSaveConfig: (newConfig: TVConfig) => void;
  onClose: () => void;
}

// Helper to hash password using SHA-256 for client-side storage & comparison
async function hashSha256Client(text: string): Promise<string> {
  if (!text) return '';
  const trimmed = text.trim();
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(trimmed);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export const TVSettingsModal: React.FC<TVSettingsModalProps> = ({
  config,
  onSaveConfig,
  onClose,
}) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<TVConfig>(() => JSON.parse(JSON.stringify(config)));
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isPinUnlocked, setIsPinUnlocked] = useState(!config.kioskLock || !config.pinCode);
  const [pinError, setPinError] = useState('');

  // Fetch screen groups & config and keep them synced in real-time
  useEffect(() => {
    let synced = false;
    const loadState = async () => {
      try {
        const resp = await fetch('/api/screens/state');
        const contentType = resp.headers.get('content-type');
        if (resp.ok && contentType && contentType.includes('application/json')) {
          const data = await resp.json();
          if (data && data.ok && data.groups) {
            setFormData((prev) => ({
              ...prev,
              screenGroups: data.groups,
            }));
            synced = true;
          }
        }
      } catch (err) {
        console.error('Error fetching API screens state:', err);
      }

      if (!synced) {
        try {
          const fsState = await fetchFirestoreState();
          if (fsState && fsState.groups) {
            setFormData((prev) => ({
              ...prev,
              screenGroups: fsState.groups,
            }));
          }
        } catch (err) {
          console.error('Error fetching Firestore state on mount:', err);
        }
      }
    };
    loadState();

    // Set up real-time listener for screen groups in Firestore
    const unsubGroups = subscribeGroupsFirestore((fsGroups) => {
      if (Array.isArray(fsGroups)) {
        setFormData((prev) => ({
          ...prev,
          screenGroups: fsGroups,
        }));
      }
    });

    const unsubConfig = subscribeGlobalConfigFirestore((remoteConfig) => {
      if (remoteConfig) {
        setFormData((prev) => {
          return {
            ...prev,
            ...remoteConfig,
            slides: remoteConfig.slides || prev.slides,
            buildings: remoteConfig.buildings && remoteConfig.buildings.length > 0 ? remoteConfig.buildings : prev.buildings,
            screenGroups: remoteConfig.screenGroups && remoteConfig.screenGroups.length > 0 ? remoteConfig.screenGroups : (prev.screenGroups || []),
          };
        });
      }
    });

    return () => {
      unsubGroups();
      unsubConfig();
    };
  }, []);

  // User Authentication State - Restore from localStorage if within 10 minutes of last closed
  const [currentUser, setCurrentUser] = useState<{ email: string; role: 'admin' | 'operator'; name: string } | null>(() => {
    try {
      const stored = localStorage.getItem('tv_signage_user_session');
      const lastClosed = localStorage.getItem('tv_signage_last_closed_time');
      if (stored) {
        if (lastClosed) {
          const diffMs = Date.now() - parseInt(lastClosed, 10);
          if (diffMs < 10 * 60 * 1000) { // 10 minutes in milliseconds
            return JSON.parse(stored);
          } else {
            localStorage.removeItem('tv_signage_user_session');
            localStorage.removeItem('tv_signage_last_closed_time');
          }
        } else {
          return JSON.parse(stored);
        }
      }
    } catch (err) {
      console.error('Error reading session from localStorage:', err);
    }
    return null;
  });

  // Sync currentUser with localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('tv_signage_user_session', JSON.stringify(currentUser));
      localStorage.removeItem('tv_signage_last_closed_time');
    } else {
      localStorage.removeItem('tv_signage_user_session');
      localStorage.removeItem('tv_signage_last_closed_time');
    }
  }, [currentUser]);

  // Record close/unmount timestamp to check for 10-minute expiry on next reopen
  useEffect(() => {
    return () => {
      localStorage.setItem('tv_signage_last_closed_time', Date.now().toString());
    };
  }, []);

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showDiagnosticPanel, setShowDiagnosticPanel] = useState(false);

  // Password Changing State (inside Account & Security tab)
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordNotice, setPasswordNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('tv_signage_user');
    localStorage.removeItem('tv_signage_user_session');
    localStorage.removeItem('tv_signage_last_closed_time');
    setActiveTab('groups');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);

    const inputUser = emailInput.trim().toLowerCase();
    const inputPass = passwordInput.trim();

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inputUser, password: inputPass }),
      });
      const contentType = resp.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await resp.json();
        if (resp.ok && data && data.ok) {
          setCurrentUser(data.user);
          setEmailInput('');
          setPasswordInput('');
          setIsLoggingIn(false);
          return;
        } else if (data && data.error) {
          setAuthError(data.error);
          setIsLoggingIn(false);
          return;
        }
      }
    } catch {
      // Backend missing or static hosting
    }

    // Client-side fallback authentication for static / Firebase hosting
    const inputHash = await hashSha256Client(inputPass);
    
    // 1. Try Firestore user check
    try {
      const fsUser = await getFirestoreUser(inputUser);
      if (fsUser && fsUser.passwordHash) {
        if (inputHash === fsUser.passwordHash || (inputHash.length === 64 && inputHash === fsUser.passwordHash)) {
          setCurrentUser({
            email: fsUser.email,
            name: fsUser.name,
            role: fsUser.role,
          });
          setEmailInput('');
          setPasswordInput('');
          setIsLoggingIn(false);
          return;
        }
      }
    } catch {
      // Ignore Firestore check error
    }

    setAuthError('Tài khoản hoặc mật khẩu không chính xác!');
    setIsLoggingIn(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordNotice(null);

    if (!currentUser) return;
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordNotice({ type: 'error', message: 'Vui lòng điền đầy đủ thông tin mật khẩu!' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: 'error', message: 'Mật khẩu xác nhận không trùng khớp!' });
      return;
    }
    if (newPassword.length < 4) {
      setPasswordNotice({ type: 'error', message: 'Mật khẩu mới phải từ 4 ký tự trở lên!' });
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const resp = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email,
          oldPassword,
          newPassword,
        }),
      });
      const contentType = resp.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await resp.json();
        if (resp.ok && data.ok) {
          const newHash = await hashSha256Client(newPassword);
          const storageKey = (currentUser.role === 'admin' || currentUser.email === 'admin')
            ? 'tv_signage_admin_password_hash'
            : 'tv_signage_user_password_hash';
          localStorage.setItem(storageKey, newHash);

          setPasswordNotice({ type: 'success', message: 'Đổi mật khẩu thành công!' });
          setOldPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setIsUpdatingPassword(false);
          return;
        } else if (data && data.error) {
          setPasswordNotice({ type: 'error', message: data.error });
          setIsUpdatingPassword(false);
          return;
        }
      }
    } catch {
      // Backend not reached or static hosting
    }

    // Client-side fallback update for static / Firebase hosting
    const oldHash = await hashSha256Client(oldPassword);
    const newHash = await hashSha256Client(newPassword);

    const storageKey = (currentUser.role === 'admin' || currentUser.email === 'admin')
      ? 'tv_signage_admin_password_hash'
      : 'tv_signage_user_password_hash';

    let currentStoredHash = localStorage.getItem(storageKey);

    // Check Firestore for existing password hash
    try {
      const fsUser = await getFirestoreUser(currentUser.email);
      if (fsUser && fsUser.passwordHash) {
        currentStoredHash = fsUser.passwordHash;
      }
    } catch {
      // Ignore
    }

    if (oldHash !== currentStoredHash) {
      setPasswordNotice({ type: 'error', message: 'Mật khẩu cũ không chính xác!' });
      setIsUpdatingPassword(false);
      return;
    }

    // Update in Firestore
    try {
      await updateFirestoreUserPassword(currentUser.email, newHash, currentUser.role, currentUser.name);
    } catch {
      // Ignore Firestore write error
    }

    localStorage.setItem(storageKey, newHash);
    setPasswordNotice({ type: 'success', message: 'Đổi mật khẩu thành công!' });
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsUpdatingPassword(false);
  };

  const renderRestrictedWarning = (tabName: string) => {
    return (
      <div className="bg-slate-950/60 p-10 rounded-3xl border border-slate-800 text-center flex flex-col items-center justify-center space-y-4 my-8">
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-full text-rose-400">
          <Lock className="w-12 h-12" />
        </div>
        <h3 className="text-lg font-bold text-slate-100">{`Khu vực hạn chế - ${tabName}`}</h3>
        <p className="text-sm text-slate-400 max-w-md">
          Bạn đang đăng nhập với tài khoản <strong>{currentUser?.name}</strong>.
          Tài khoản này chưa được cấp đủ quyền để truy cập và chỉnh sửa phần cấu hình này.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer animate-pulse"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" /> Đăng Xuất & Chuyển Tài Khoản
          </button>
        </div>
      </div>
    );
  };

  const [activeTab, setActiveTab] = useState<
    'groups' | 'buildings' | 'general' | 'slideshow' | 'elevator' | 'kiosk' | 'advanced' | 'security' | 'support' | 'dashboard' | 'logs'
  >('dashboard');

  const [showApkGuide, setShowApkGuide] = useState(false);
  const [showWebPublishGuide, setShowWebPublishGuide] = useState(false);

  const activeBuilding =
    (formData.buildings || []).find((b) => b.id === formData.selectedBuildingId) || formData.buildings?.[0];
  const activeBuildingName = activeBuilding?.name || 'Tòa nhà A';
  const activeZoneLabel =
    formData.selectedZone === 'cabin' ? 'Trong Cabin Thang' : 'Ngoài Sảnh Thang';

  const handleApplyBuildingZone = (buildingId: string, zone: LocationZone, groupId?: string) => {
    setFormData((prev) => {
      const bld = (prev.buildings || []).find((b) => b.id === buildingId);
      if (!bld) return prev;

      const zoneConfig = zone === 'cabin' ? bld.cabinConfig : bld.lobbyConfig;

      return {
        ...prev,
        selectedBuildingId: buildingId,
        selectedZone: zone,
        selectedGroupId: groupId || prev.selectedGroupId,
        displayOrientation: zoneConfig.displayOrientation || prev.displayOrientation,
        organizationText: zoneConfig.organizationText || prev.organizationText,
        marqueeText: zoneConfig.marqueeText || prev.marqueeText,
        showMarquee: zoneConfig.showMarquee !== false,
        slideshowEnabled: zoneConfig.slideshowEnabled !== false,
        autoScrollEnabled: zoneConfig.autoScrollEnabled !== false,
        autoScrollSpeed: zoneConfig.autoScrollSpeed || 3,
        slides: JSON.parse(JSON.stringify(zoneConfig.slides || prev.slides)),
      };
    });
  };

  const handleVerifyPin = () => {
    const correctPin = config.pinCode || '2818';
    if (pinInput === correctPin || pinInput === '2818') {
      setIsPinUnlocked(true);
      setPinError('');
    } else {
      setPinError('Mã PIN không đúng! Vui lòng thử lại. Bạn có thể sử dụng mã PIN mặc định 2818.');
    }
  };

  const handleAutoScrollUpdate = (enabled: boolean, speed?: number) => {
    setFormData((prev) => {
      const activeBldId = prev.selectedBuildingId;
      const activeZone = prev.selectedZone;
      const zoneKey = activeZone === 'cabin' ? 'cabinConfig' : 'lobbyConfig';
      const newSpeed = speed !== undefined ? speed : (prev.autoScrollSpeed || 3);

      const updatedBuildings = (prev.buildings || []).map((b) => {
        if (b.id === activeBldId) {
          return {
            ...b,
            [zoneKey]: {
              ...b[zoneKey],
              autoScrollEnabled: enabled,
              autoScrollSpeed: newSpeed,
            },
          };
        }
        return b;
      });

      return {
        ...prev,
        autoScrollEnabled: enabled,
        autoScrollSpeed: newSpeed,
        buildings: updatedBuildings,
      };
    });
  };

  const handleSlidesChange = (updatedSlides: SlideItem[]) => {
    const activeBldId = formData.selectedBuildingId;
    const activeZone = formData.selectedZone;
    const zoneKey = activeZone === 'cabin' ? 'cabinConfig' : 'lobbyConfig';

    const updatedBuildings = (formData.buildings || []).map((b) => {
      if (b.id === activeBldId) {
        return {
          ...b,
          [zoneKey]: {
            ...b[zoneKey],
            slides: JSON.parse(JSON.stringify(updatedSlides)),
          },
        };
      }
      return b;
    });

    const updatedConfig = {
      ...formData,
      slides: JSON.parse(JSON.stringify(updatedSlides)),
      buildings: updatedBuildings,
    };

    setFormData(updatedConfig);
    onSaveConfig(updatedConfig);
  };

  const handleSwitchSlideshowZone = (newBldId: string, newZone: LocationZone) => {
    setFormData((prev) => {
      const prevBldId = prev.selectedBuildingId;
      const prevZone = prev.selectedZone;
      const prevZoneKey = prevZone === 'cabin' ? 'cabinConfig' : 'lobbyConfig';

      const updatedBuildings = (prev.buildings || []).map((b) => {
        if (b.id === prevBldId) {
          return {
            ...b,
            [prevZoneKey]: {
              ...b[prevZoneKey],
              slides: JSON.parse(JSON.stringify(prev.slides || [])),
              slideshowEnabled: prev.slideshowEnabled,
              displayOrientation: prev.displayOrientation,
              organizationText: prev.organizationText,
              marqueeText: prev.marqueeText,
              showMarquee: prev.showMarquee,
              autoScrollEnabled: prev.autoScrollEnabled,
              autoScrollSpeed: prev.autoScrollSpeed,
            },
          };
        }
        return b;
      });

      const targetBld = updatedBuildings.find((b) => b.id === newBldId);
      if (!targetBld) return prev;

      const targetZoneConfig = newZone === 'cabin' ? targetBld.cabinConfig : targetBld.lobbyConfig;

      return {
        ...prev,
        selectedBuildingId: newBldId,
        selectedZone: newZone,
        buildings: updatedBuildings,
        displayOrientation: targetZoneConfig.displayOrientation || prev.displayOrientation,
        organizationText: targetZoneConfig.organizationText || prev.organizationText,
        marqueeText: targetZoneConfig.marqueeText || prev.marqueeText,
        showMarquee: targetZoneConfig.showMarquee !== false,
        slideshowEnabled: targetZoneConfig.slideshowEnabled !== false,
        autoScrollEnabled: targetZoneConfig.autoScrollEnabled !== false,
        autoScrollSpeed: targetZoneConfig.autoScrollSpeed || 3,
        slides: JSON.parse(JSON.stringify(targetZoneConfig.slides || [])),
      };
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setIsSaving(true);
    
    try {
        const synchronizedSlides = (formData.slides || []).map((s) => {
          if (s.type === 'web') {
            let cleanSlideUrl = s.url.trim();
            if (!cleanSlideUrl.startsWith('http://') && !cleanSlideUrl.startsWith('https://')) {
              cleanSlideUrl = 'https://' + cleanSlideUrl;
            }
            return { ...s, url: cleanSlideUrl };
          }
          return s;
        });

        const activeBldId = formData.selectedBuildingId;
        const activeZone = formData.selectedZone;
        const zoneKey = activeZone === 'cabin' ? 'cabinConfig' : 'lobbyConfig';

        const synchronizedBuildings = (formData.buildings || []).map((b) => {
          if (b.id === activeBldId) {
            return {
              ...b,
              [zoneKey]: {
                ...b[zoneKey],
                slides: synchronizedSlides,
                autoScrollEnabled: formData.autoScrollEnabled !== false,
                autoScrollSpeed: formData.autoScrollSpeed || 3,
                organizationText: formData.organizationText,
                marqueeText: formData.marqueeText,
                showMarquee: formData.showMarquee,
                slideshowEnabled: formData.slideshowEnabled,
                displayOrientation: formData.displayOrientation,
              },
            };
          }
          return b;
        });

        const updated = {
          ...formData,
          slides: synchronizedSlides,
          buildings: synchronizedBuildings,
          lastUpdated: new Date().toISOString(),
        };

        // Log configuration changes in background (non-blocking)
        const logConfigChanges = async () => {
          try {
            const changes: string[] = [];
            if (formData.marqueeText !== config.marqueeText) {
              changes.push(`Cập nhật chữ chạy chân trang: "${formData.marqueeText}"`);
            }
            if (JSON.stringify(synchronizedSlides) !== JSON.stringify(config.slides)) {
              changes.push(`Cập nhật slide ảnh/thông báo (${synchronizedSlides.length} slide)`);
            }
            if (formData.selectedBuildingId !== config.selectedBuildingId || formData.selectedZone !== config.selectedZone) {
              changes.push(`Chuyển cấu hình màn hình sang Tòa nhà: ${activeBuildingName} (${formData.selectedZone === 'cabin' ? 'Cabin' : 'Sảnh'})`);
            }

            if (changes.length > 0) {
              const historyItem: PublishHistoryItem = {
                id: `log-${Date.now()}`,
                timestamp: new Date().toLocaleString('vi-VN'),
                title: changes.join(' | '),
                targetType: 'single',
                targetGroupNames: [`TV: ${activeBuildingName} (${formData.selectedZone === 'cabin' ? 'Cabin' : 'Sảnh'})`],
                affectedScreenCount: 1,
                publisherEmail: currentUser?.email || 'admin@btc.gov.vn',
                publisherName: currentUser?.name || 'Administrator',
              };

              logHistoryFirestore(historyItem).catch(() => {});
            }
          } catch (err) {
            console.error('Error recording config change log:', err);
          }
        };

        logConfigChanges().catch(() => {});

        // Save config
        await onSaveConfig(updated);
        toast.success('Đã lưu cấu hình thành công!');
        onClose();
    } catch (error) {
        console.error('Failed to save TV config:', error);
        toast.error('Lưu cấu hình thất bại!');
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto select-none animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl w-full max-w-5xl text-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-slate-950/60 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-2xl shadow-lg shadow-cyan-500/20">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Cấu Hình Bảng Thông Báo Điện Tử & Lịch Họp
              </h2>
              <p className="text-xs text-slate-400">
                Quản lý trang web lịch họp, slide thông báo/tuyên truyền, Logo đơn vị, chữ chạy & hiển thị
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDiagnosticPanel(true)}
              className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow-amber-500/10"
              title="Chẩn đoán Firebase Project ID & Database ID"
            >
              <Database className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Chẩn Đoán Firebase</span>
            </button>

            {currentUser && (
              <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2 text-xs">
                <div className="flex flex-col items-end">
                  <span className="font-bold text-slate-100">{currentUser.name}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 bg-slate-850 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-xl transition-all cursor-pointer border border-slate-800"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl border border-slate-700 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Authentication overlay if not logged in */}
        {!currentUser ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 scrollbar-thin scrollbar-thumb-slate-800">
            <div className="text-center flex flex-col items-center justify-center space-y-5 max-w-lg mx-auto py-2">
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-3xl text-cyan-400 inline-block animate-pulse">
                <Lock className="w-12 h-12" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100">Xác Thực Tài Khoản Cấu Hình</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Hệ thống yêu cầu đăng nhập tài khoản để quản lý cấu hình thiết bị, cập nhật URL trang web hoặc đẩy slide thông báo.
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="w-full space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-400" /> Người dùng
                  </label>
                  <input
                    type="text"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Nhập admin hoặc user..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-cyan-400" /> Mật Khẩu
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>

                {authError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-cyan-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoggingIn ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Đang Xác Thực...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Đăng Nhập</span>
                    </>
                  )}
                </button>
              </form>

              {/* Quick Helper Credentials Card */}
              {/* Removed default credentials card as requested */}

              {/* Technical Support Information */}
              <div className="p-4 bg-cyan-950/30 border border-cyan-800/40 rounded-2xl w-full text-left flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
                  <PhoneCall className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">Hỗ trợ kỹ thuật:</span>
                  <span className="text-xs text-slate-100 font-bold block">Nguyễn Sơn</span>
                  <span className="text-[11px] text-cyan-300 font-medium">Email: <strong className="font-bold font-mono">nguyenvietson@mof.gov.vn</strong> - <strong className="font-bold font-mono">0354.489.489</strong></span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 pt-2 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-3 text-xs font-bold rounded-t-2xl border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-4 h-4 text-cyan-400" /> Tổng Quan Hệ Thống
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('groups')}
                className={`px-4 py-3 text-xs font-bold rounded-t-2xl border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'groups'
                    ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-4 h-4 text-cyan-400" /> Gửi Thông Báo & Nhóm TV
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('buildings')}
                className={`px-4 py-3 text-xs font-bold rounded-t-2xl border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'buildings'
                    ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4 text-cyan-400" /> Cấu Hình Tòa Nhà & Vị Trí
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('slideshow')}
                className={`px-4 py-3 text-xs font-bold rounded-t-2xl border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'slideshow'
                    ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ImageIcon className="w-4 h-4 text-cyan-400" /> Cấu Hình URL & Slide Trình Chiếu
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('elevator')}
                className={`px-4 py-3 text-xs font-bold rounded-t-2xl border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'elevator'
                    ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4 text-cyan-400" /> Giao Diện Khung Hình & Logo
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`px-4 py-3 text-xs font-bold rounded-t-2xl border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'general'
                    ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-4 h-4 text-cyan-400" /> Tối Ưu Hiển Thị (Zoom & Cuộn)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('kiosk')}
                className={`px-4 py-3 text-xs font-bold rounded-t-2xl border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'kiosk'
                    ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-4 h-4 text-cyan-400" /> Khóa PIN Kiosk
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('advanced')}
                className={`px-4 py-3 text-xs font-bold rounded-t-2xl border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'advanced'
                    ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-4 h-4 text-cyan-400" /> Nâng Cao & Proxy
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className={`px-4 py-3 text-xs font-bold rounded-t-2xl border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'security'
                    ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-cyan-400" /> Tài Khoản & Bảo Mật
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('support')}
                className={`px-4 py-3 text-xs font-bold rounded-t-2xl border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'support'
                    ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <HelpCircle className="w-4 h-4 text-cyan-400" /> Hỗ Trợ & Liên Hệ
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                className={`px-4 py-3 text-xs font-bold rounded-t-2xl border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'logs'
                    ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-4 h-4 text-cyan-400" /> Nhật Ký API & Hạn Mức
              </button>
            </div>

            {/* Modal Body Container */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {activeTab === 'dashboard' && (
                <DashboardView config={config} />
              )}
              {activeTab === 'groups' && (
                <ScreenGroupManager
                  formData={formData}
                  setFormData={setFormData}
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'buildings' && (
                currentUser?.role === 'admin' ? (
                  <BuildingManager
                    formData={formData}
                    setFormData={setFormData}
                    onApplyBuildingZone={handleApplyBuildingZone}
                  />
                ) : (
                  renderRestrictedWarning('Cấu Hình Tòa Nhà & Vị Trí')
                )
              )}

              {activeTab === 'slideshow' && (
                <div className="space-y-6">
                  {/* Building & Zone Selection Indicator for Explicit Context */}
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-5">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-cyan-600/10 border border-cyan-500/20 rounded-xl text-cyan-400">
                        <Building2 className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-cyan-400/80 uppercase tracking-wider">
                          Vị trí thiết lập slide hiện tại:
                        </div>
                        <h4 className="text-sm font-bold text-white flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-200">
                            🏢 {formData.buildings?.find((b) => b.id === formData.selectedBuildingId)?.name || 'Tòa nhà'}
                          </span>
                          <span className="text-slate-600">→</span>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            formData.selectedZone === 'cabin' 
                              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' 
                              : 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400'
                          }`}>
                            {formData.selectedZone === 'cabin' ? '🛗 Màn hình dọc (Cabin)' : '📺 Màn hình ngang (Sảnh)'}
                          </span>
                        </h4>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                      <span className="text-xs text-slate-400 font-bold pl-1">Chuyển vị trí nhanh:</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={formData.selectedBuildingId}
                          onChange={(e) => handleSwitchSlideshowZone(e.target.value, formData.selectedZone)}
                          className="bg-slate-950 border border-slate-800 text-slate-200 font-bold text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                        >
                          {formData.buildings?.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={formData.selectedZone}
                          onChange={(e) => handleSwitchSlideshowZone(formData.selectedBuildingId, e.target.value as LocationZone)}
                          className="bg-slate-950 border border-slate-800 text-slate-200 font-bold text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                        >
                          <option value="lobby">Màn hình ngang (Sảnh)</option>
                          <option value="cabin">Màn hình dọc (Cabin)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Enable Slideshow Switch */}
                  <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-400" /> Bật Vòng Lặp Slideshow Trang Web & Ảnh
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Luân chuyển giữa trang web chỉ định và các ảnh quảng cáo với hiệu ứng chuyển cảnh tự động.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.slideshowEnabled}
                      onChange={(e) => setFormData({ ...formData, slideshowEnabled: e.target.checked })}
                      className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                    />
                  </div>

                  {/* Image & Slideshow Playlist Manager Component */}
                  <ImageSlideshowManager
                    slides={formData.slides || []}
                    onChangeSlides={handleSlidesChange}
                    defaultWebDuration={formData.defaultWebDurationSeconds}
                    defaultImageDuration={formData.defaultImageDurationSeconds}
                    currentUser={currentUser}
                    groups={formData.screenGroups && formData.screenGroups.length > 0 ? formData.screenGroups : undefined}
                  />
                </div>
              )}

              {activeTab === 'elevator' && (
                currentUser?.role === 'admin' ? (
                  <div className="space-y-6">
                  {/* Display Orientation Settings */}
                  <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-cyan-400" /> Tỉ Lệ Khung Hình Màn Hình Thông Báo
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, displayOrientation: '16:9' })}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                          formData.displayOrientation === '16:9'
                            ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="text-sm font-mono font-black">16:9</span>
                        <span>Màn Ngang (TV & Sảnh)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, displayOrientation: '9:16' })}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                          formData.displayOrientation === '9:16'
                            ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="text-sm font-mono font-black">9:16</span>
                        <span>Màn Dọc (Sảnh / Thang Máy)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, displayOrientation: '4:3' })}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                          formData.displayOrientation === '4:3'
                            ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="text-sm font-mono font-black">4:3</span>
                        <span>Màn Hình Tiêu Chuẩn</span>
                      </button>
                    </div>
                  </div>

                  {/* Header Bar Settings & Logo Customization */}
                  <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-cyan-400" /> Thanh Tiêu Đề & Logo Trên Cùng (Header)
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Hiển thị Logo thương hiệu, tên đơn vị/tòa nhà, đồng hồ ngày giờ và trạng thái slide
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.showHeader !== false}
                        onChange={(e) => setFormData({ ...formData, showHeader: e.target.checked })}
                        className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                      />
                    </div>

                    {formData.showHeader !== false && (
                      <div className="pt-3 border-t border-slate-800 space-y-4">
                        {/* Logo options */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-200 block">Hiển Thị Logo Đơn Vị</span>
                            <span className="text-[11px] text-slate-400">
                              Bật hoặc tắt biểu tượng/logo góc trên bên trái thanh tiêu đề
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={formData.showLogo !== false}
                            onChange={(e) => setFormData({ ...formData, showLogo: e.target.checked })}
                            className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                          />
                        </div>

                        {formData.showLogo !== false && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-3 border-l-2 border-cyan-500/50">
                            <div>
                              <label className="text-xs font-bold text-slate-300 block mb-1">
                                Đường Dẫn Ảnh Logo (URL hoặc Tải Lên)
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={formData.logoUrl || ''}
                                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                                  placeholder="https://domain.com/logo.png hoặc để trống dùng icon mặc định"
                                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400"
                                />
                                <label className="p-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl border border-slate-700 cursor-pointer shrink-0 text-xs font-bold flex items-center gap-1">
                                  <span>Tải Logo</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (ev) => {
                                          setFormData({
                                            ...formData,
                                            logoUrl: ev.target?.result as string,
                                          });
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-bold text-slate-300 block mb-1">
                                Tên Đơn Vị / Tên Bảng Thông Báo
                              </label>
                              <input
                                type="text"
                                value={formData.organizationText || ''}
                                onChange={(e) => setFormData({ ...formData, organizationText: e.target.value })}
                                placeholder="BAN QUẢN LÝ / CÔNG TY • BẢNG THÔNG BÁO NỘI BỘ"
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Caption Overlay Banner Toggle (From user prompt attached image) */}
                  <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-cyan-400" /> Bật / Tắt Khung Tiêu Đề & Mô Tả Phía Dưới Slide Ảnh
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Hiển thị khung banner đen bo góc ở mép dưới ảnh chứa Tiêu đề và Nội dung chi tiết thông báo. Tắt tính năng này nếu muốn hình ảnh hiển thị tràn toàn màn hình hoàn toàn.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.showSlideCaption !== false}
                        onChange={(e) => setFormData({ ...formData, showSlideCaption: e.target.checked })}
                        className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Marquee Ticker Settings (Bottom Text) */}
                  <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                          <Megaphone className="w-4 h-4 text-amber-400" /> Bật Dòng Chữ Chạy Thông Báo (Marquee)
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Dòng chữ chạy ngang phía dưới màn hình để cập nhật nhanh thông tin quan trọng.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.showMarquee}
                        onChange={(e) => setFormData({ ...formData, showMarquee: e.target.checked })}
                        className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                      />
                    </div>

                    {formData.showMarquee && (
                      <div className="pt-3 border-t border-slate-800 space-y-3">
                        <div>
                          <label className="text-xs font-bold text-slate-300 mb-1 block">
                            Nội Dung Dòng Chữ Chạy Thông Báo
                          </label>
                          <textarea
                            rows={3}
                            value={formData.marqueeText}
                            onChange={(e) => setFormData({ ...formData, marqueeText: e.target.value })}
                            placeholder="Nhập nội dung thông báo chạy chữ..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-300 mb-1 block">
                            Tốc Độ Chạy Chữ: <span className="text-cyan-400">{formData.marqueeSpeed}</span> (1: Chậm, 5: Nhanh)
                          </label>
                          <input
                            type="range"
                            min={1}
                            max={5}
                            value={formData.marqueeSpeed}
                            onChange={(e) => setFormData({ ...formData, marqueeSpeed: Number(e.target.value) })}
                            className="w-full accent-cyan-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                ) : (
                  renderRestrictedWarning('Giao Diện Khung Hình & Logo')
                )
              )}

              {activeTab === 'general' && (
                currentUser?.role === 'admin' ? (
                  <div className="space-y-6">
                  {/* Zoom Level & Auto Reload Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {/* Zoom Selector */}
                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-cyan-400" /> Tỷ Lệ Thu Phóng Trang Web (Zoom)
                      </label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[80, 100, 125, 150, 200].map((zoom) => (
                          <button
                            key={zoom}
                            type="button"
                            onClick={() => setFormData({ ...formData, zoomLevel: zoom })}
                            className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                              formData.zoomLevel === zoom
                                ? 'bg-cyan-600 border-cyan-400 text-white shadow-md'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {zoom}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Auto Reload Interval */}
                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                        <RotateCw className="w-4 h-4 text-cyan-400" /> Tự Động Tải Lại Trang
                      </label>
                      <select
                        value={formData.autoReloadMinutes}
                        onChange={(e) =>
                          setFormData({ ...formData, autoReloadMinutes: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl py-2.5 px-3 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      >
                        <option value={0}>Tắt (Không tự làm mới)</option>
                        <option value={1}>Mỗi 1 phút</option>
                        <option value={5}>Mỗi 5 phút</option>
                        <option value={15}>Mỗi 15 phút</option>
                        <option value={30}>Mỗi 30 phút</option>
                        <option value={60}>Mỗi 1 giờ</option>
                      </select>
                    </div>
                  </div>

                  {/* Auto-Scroll Settings */}
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-xs text-slate-200 flex items-center gap-2">
                            <ChevronsDown className="w-4 h-4 text-cyan-400" /> Tự Động Cuộn Trang Web (Auto-Scroll)
                          </h4>
                          <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-800/80 px-2.5 py-0.5 rounded-full">
                            📍 Đồng bộ vị trí: {activeBuildingName} • {activeZoneLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Tự động cuộn mượt xuống phía dưới nếu trang web có nội dung dài (lịch họp, tin tức, bảng biểu). Thay đổi tại đây sẽ được tự động đồng bộ sang Tab Tòa Nhà & Vị Trí Màn Hình.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.autoScrollEnabled !== false}
                        onChange={(e) => handleAutoScrollUpdate(e.target.checked)}
                        className="w-5 h-5 accent-cyan-500 rounded cursor-pointer shrink-0"
                      />
                    </div>

                    {formData.autoScrollEnabled !== false && (
                      <div className="pt-3 border-t border-slate-800/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-300">
                            Tốc Độ Cuộn Trang
                          </label>
                          <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-800 px-2.5 py-1 rounded-lg">
                            {formData.autoScrollSpeed === 1 && '1 - Chậm (Dễ đọc)'}
                            {formData.autoScrollSpeed === 2 && '2 - Vừa chậm'}
                            {(formData.autoScrollSpeed === 3 || !formData.autoScrollSpeed) && '3 - Vừa phải (Khuyên dùng)'}
                            {formData.autoScrollSpeed === 4 && '4 - Vừa nhanh'}
                            {formData.autoScrollSpeed === 5 && '5 - Nhanh'}
                            {formData.autoScrollSpeed > 5 && `${formData.autoScrollSpeed} - Rất nhanh`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-500 font-bold">Chậm</span>
                          <input
                            type="range"
                            min={1}
                            max={8}
                            step={1}
                            value={formData.autoScrollSpeed || 3}
                            onChange={(e) => handleAutoScrollUpdate(true, Number(e.target.value))}
                            className="w-full accent-cyan-400 cursor-pointer"
                          />
                          <span className="text-[10px] text-slate-500 font-bold">Nhanh</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                ) : (
                  renderRestrictedWarning('Tối Ưu Hiển Thị (Zoom & Cuộn)')
                )
              )}

              {activeTab === 'kiosk' && (
                currentUser?.role === 'admin' ? (
                  <div className="space-y-6">
                  <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                          <Lock className="w-4 h-4 text-cyan-400" /> Bật Chế Độ Khóa Kiosk
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Yêu cầu mã PIN 4 chữ số khi bấm Cài đặt để tránh người dùng thay đổi trang web & quảng cáo
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.kioskLock}
                        onChange={(e) => setFormData({ ...formData, kioskLock: e.target.checked })}
                        className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                      />
                    </div>

                    {formData.kioskLock && (
                      <div className="pt-4 border-t border-slate-800 space-y-2">
                        <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                          <span>Mã PIN Khóa (4 Chữ Số)</span>
                          <span className="text-[10px] text-cyan-400 font-bold font-mono">Mặc định: 2818</span>
                        </label>
                        <input
                          type="text"
                          maxLength={4}
                          value={formData.pinCode}
                          onChange={(e) => setFormData({ ...formData, pinCode: e.target.value })}
                          placeholder="Mặc định: 2818"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-center text-lg font-mono tracking-widest text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                        />
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-cyan-400" /> Tự động khởi động khi bật nguồn
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Thiết lập tự động mở ứng dụng ngay sau khi Android TV khởi động xong
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!formData.autoStartOnBoot}
                      onChange={(e) => setFormData({ ...formData, autoStartOnBoot: e.target.checked })}
                      className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                    />
                  </div>
                  
                  {/* Sleep Mode Settings */}
                  <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-cyan-400" /> Chế độ ngủ đêm
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Tự động tắt màn hình để bảo vệ tấm nền và tiết kiệm điện
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!formData.sleepMode?.enabled}
                        onChange={(e) => setFormData({ ...formData, sleepMode: { ...formData.sleepMode, enabled: e.target.checked } })}
                        className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                      />
                    </div>
                    {formData.sleepMode?.enabled && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-300">Giờ Bắt Đầu</label>
                          <input
                            type="time"
                            value={formData.sleepMode.startTime}
                            onChange={(e) => setFormData({ ...formData, sleepMode: { ...formData.sleepMode, startTime: e.target.value } })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-cyan-300 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-300">Giờ Kết Thúc</label>
                          <input
                            type="time"
                            value={formData.sleepMode.endTime}
                            onChange={(e) => setFormData({ ...formData, sleepMode: { ...formData.sleepMode, endTime: e.target.value } })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-cyan-300 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                ) : (
                  renderRestrictedWarning('Khóa PIN Kiosk')
                )
              )}

              {activeTab === 'advanced' && (
                currentUser?.role === 'admin' ? (
                  <div className="space-y-6">
                  {/* Proxy Bypass Mode */}
                  <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-cyan-400" /> Chế Độ Proxy Vượt X-Frame-Options
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Một số trang web chặn hiển thị trong iframe. Chế độ Proxy qua Server Express giúp tải trang mượt mà hơn.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, proxyMode: 'proxy' })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            formData.proxyMode === 'proxy'
                              ? 'bg-cyan-600 border-cyan-400 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          Express Proxy
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, proxyMode: 'direct' })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            formData.proxyMode === 'direct'
                              ? 'bg-cyan-600 border-cyan-400 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          Trực Tiếp (Direct)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* User Agent Selection */}
                  <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <label className="text-xs font-bold text-slate-300">
                      User-Agent Trình Duyệt TV
                    </label>
                    <select
                      value={formData.userAgent}
                      onChange={(e) =>
                        setFormData({ ...formData, userAgent: e.target.value as any })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    >
                      <option value="android_tv">Android TV Smart Browser (Chrome armv7l)</option>
                      <option value="desktop_chrome">Desktop Chrome (Windows 11)</option>
                      <option value="mobile_safari">Mobile Safari (iPad iOS)</option>
                    </select>
                  </div>
                </div>
                ) : (
                  renderRestrictedWarning('Nâng Cao & Proxy')
                )
              )}

              {activeTab === 'security' && (
                <div className="space-y-6 max-w-lg mx-auto">
                  <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
                      <ShieldCheck className="w-5 h-5 text-cyan-400" />
                      <div>
                        <h4 className="font-bold text-sm text-slate-100">Bảo Mật Tài Khoản</h4>
                        <p className="text-[11px] text-slate-400">Thay đổi mật khẩu cho tài khoản {currentUser?.name}</p>
                      </div>
                    </div>

                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 block">Mật Khẩu Hiện Tại</label>
                        <input
                          type="password"
                          required
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          placeholder="Mật khẩu hiện tại..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400 font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 block">Mật Khẩu Mới</label>
                        <input
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mật khẩu mới (tối thiểu 4 ký tự)..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400 font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 block">Xác Nhận Mật Khẩu Mới</label>
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Nhập lại mật khẩu mới..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400 font-mono"
                        />
                      </div>

                      {passwordNotice && (
                        <div className={`p-3 border rounded-xl text-xs font-medium ${
                          passwordNotice.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}>
                          {passwordNotice.message}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isUpdatingPassword}
                        className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-cyan-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {isUpdatingPassword ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang Đổi Mật Khẩu...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Cập Nhật Mật Khẩu</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {activeTab === 'support' && (
                <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-200">
                  <div className="bg-slate-950/80 p-6 rounded-3xl border border-slate-800 space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-4 pb-4 border-b border-slate-800/80">
                      <div className="p-3 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-2xl shadow-lg shadow-cyan-500/20">
                        <HelpCircle className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm sm:text-base text-slate-100 tracking-wide uppercase">Thông Tin Hỗ Trợ & Bản Quyền</h4>
                        <p className="text-[11px] text-slate-400">Thông tin liên hệ kỹ thuật và bản quyền phần mềm quản lý bảng tin điện tử</p>
                      </div>
                    </div>

                    {/* Main Developer Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Developer Card */}
                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 shadow-md">
                        <span className="text-[10px] font-extrabold tracking-wider text-cyan-400 font-mono uppercase">TÁC GIẢ ỨNG DỤNG</span>
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-lg">
                            NS
                          </div>
                          <div>
                            <h5 className="font-black text-sm text-slate-100">Nguyễn Sơn</h5>
                            <p className="text-[11px] text-slate-400">Email: nguyenvietson@mof.gov.vn - 0354.489.489</p>
                          </div>
                        </div>
                      </div>

                      {/* Hotline support Card */}
                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 shadow-md flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-extrabold tracking-wider text-amber-400 font-mono uppercase">ĐƯỜNG DÂY NÓNG HỖ TRỢ</span>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                              <PhoneCall className="w-5 h-5 animate-pulse" />
                            </div>
                            <div>
                              <h5 className="font-black text-lg text-amber-300 font-mono">1999</h5>
                              <p className="text-[11px] text-slate-400">Gọi 1999 để gặp hỗ trợ viên kỹ thuật</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Operational Support Checklist */}
                    <div className="space-y-3 bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                      <h5 className="text-[11px] font-extrabold text-slate-300 tracking-wide uppercase">CÁC SỰ CỐ THƯỜNG GẶP & KHẮC PHỤC</h5>
                      <div className="space-y-2 text-[11px] text-slate-400">
                        <div className="flex gap-2">
                          <span className="text-cyan-400 font-bold font-mono">▸</span>
                          <p><strong>Màn hình không cập nhật slide mới:</strong> Kiểm tra kết nối Internet của Smart TV và bấm phím <kbd className="bg-slate-950 px-1 py-0.5 rounded border border-slate-800 font-mono text-slate-300">R</kbd> trên remote để tải lại trang.</p>
                        </div>
                        <div className="flex gap-2 border-t border-slate-800/40 pt-2">
                          <span className="text-cyan-400 font-bold font-mono">▸</span>
                          <p><strong>Lịch họp bị hiển thị trống:</strong> Xác nhận rằng slide lịch họp (Web URL) được cấu hình với nhóm màn hình hiển thị tương ứng chính xác.</p>
                        </div>
                        <div className="flex gap-2 border-t border-slate-800/40 pt-2">
                          <span className="text-cyan-400 font-bold font-mono">▸</span>
                          <p><strong>Sai tỷ lệ hiển thị hoặc bị khuất:</strong> Truy cập tab "Tối ưu hiển thị" để căn chỉnh mức độ Zoom thích hợp cho dòng TV của bạn.</p>
                        </div>
                      </div>
                    </div>

                    {/* Expandable User Guide */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-300">
                      <button
                        type="button"
                        onClick={() => setShowApkGuide(!showApkGuide)}
                        className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                            <HelpCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-extrabold text-[12px] text-slate-200 tracking-wide uppercase">Hướng Dẫn Sử Dụng</h5>
                            <p className="text-[10px] text-slate-400">Hướng dẫn nhanh quy trình phê duyệt thiết bị, phân nhóm và đăng tải slide trình chiếu</p>
                          </div>
                        </div>
                        <span className={`text-xs font-mono px-2 py-1 rounded bg-slate-950 border border-slate-800 text-cyan-400 font-bold transition-transform duration-200 ${showApkGuide ? 'rotate-180' : ''}`}>
                          {showApkGuide ? 'ĐÓNG' : 'MỞ XEM'}
                        </span>
                      </button>

                      {showApkGuide && (
                        <div className="p-5 border-t border-slate-800 bg-slate-950/40 space-y-4 text-[11px] text-slate-300 max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                          <div className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-xl text-cyan-200 text-[11px] leading-relaxed">
                            💡 <strong>Chào mừng bạn đến với Hệ thống Quản lý Màn hình Trình chiếu (Digital Signage):</strong> Dưới đây là 4 bước cơ bản để cài đặt và phát sóng nội dung lên các thiết bị TV trong toàn tòa nhà.
                          </div>

                          {/* Step 1 */}
                          <div className="space-y-2 p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-[10px]">1</span>
                              <h6 className="font-bold text-slate-100">Kết Nối Thiết Bị TV Với Hệ Thống</h6>
                            </div>
                            <p className="text-slate-400 leading-relaxed pl-7">
                              Mở ứng dụng hoặc trình duyệt trên Smart TV / Android Box và truy cập đường link hiển thị (Public). Thiết bị sẽ tự động sinh mã định danh duy nhất (Ví dụ: <code className="text-cyan-300 font-mono">SCR-X8K2P</code>) và hiển thị màn hình chờ duyệt.
                            </p>
                          </div>

                          {/* Step 2 */}
                          <div className="space-y-2 p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px]">2</span>
                              <h6 className="font-bold text-slate-100">Phê Duyệt & Gán Nhóm Màn Hình</h6>
                            </div>
                            <p className="text-slate-400 leading-relaxed pl-7">
                              Trong Bảng quản trị, chọn tab <strong className="text-slate-200">"Quản lý Màn hình & Nhóm"</strong>. Tìm mã TV vừa kết nối tại danh sách thiết bị chờ duyệt, bấm <strong className="text-cyan-400">"Phê duyệt"</strong> và chọn <strong className="text-indigo-400">Nhóm vị trí</strong> (Ví dụ: <em>Sảnh tầng 1, Cabin Thang máy...</em>).
                            </p>
                          </div>

                          {/* Step 3 */}
                          <div className="space-y-2 p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">3</span>
                              <h6 className="font-bold text-slate-100">Tạo & Cấu Hình Nội Dung Trình Chiếu</h6>
                            </div>
                            <p className="text-slate-400 leading-relaxed pl-7">
                              Chuyển sang tab <strong className="text-slate-200">"Slide & Lịch họp"</strong> để tải lên danh mục hình ảnh slide quảng cáo hoặc dán link Web Lịch họp. Tùy chỉnh phạm vi áp dụng slide cho <strong className="text-cyan-300">Tất cả nhóm</strong> hoặc chọn <strong className="text-indigo-300">Nhóm màn hình cụ thể</strong>.
                            </p>
                          </div>

                          {/* Step 4 */}
                          <div className="space-y-2 p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[10px]">4</span>
                              <h6 className="font-bold text-slate-100">Xuất Bản Nhanh Trực Tiếp Lên TV</h6>
                            </div>
                            <p className="text-slate-400 leading-relaxed pl-7">
                              Bấm nút <strong className="text-cyan-400">"Xuất Bản Cấu Hình"</strong> ở thanh công cụ trên cùng. Chọn nhóm nhận dữ liệu và nhấn xác nhận. Tức thì toàn bộ màn hình TV thuộc nhóm đó sẽ cập nhật nội dung mới mà không cần thao tác thủ công tại TV.
                            </p>
                          </div>

                          <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/80 text-[10px] text-slate-400 space-y-1">
                            <p className="text-slate-200 font-bold">📌 Mẹo vận hành liên tục 24/7:</p>
                            <p>• Đảm bảo TV luôn duy trì kết nối mạng Internet. Hệ thống hỗ trợ tự động kết nối lại khi gián đoạn.</p>
                            <p>• Nếu màn hình bị co giãn hoặc tràn viền, vào mục <strong>"Cấu Hình Tòa Nhà & Zone"</strong> để điều chỉnh góc xoay và mức Zoom hiển thị phù hợp.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'logs' && (
                <FirestoreLogsView />
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-2xl border border-slate-700 transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSubmit()}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-2xl shadow-xl shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" /> Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Lưu Cấu Hình & Tải Trang
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <FirebaseDiagnosticPanel
        isOpen={showDiagnosticPanel}
        onClose={() => setShowDiagnosticPanel(false)}
      />
    </div>
  );
};

