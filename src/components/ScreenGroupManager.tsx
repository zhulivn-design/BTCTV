import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Tv,
  Layers,
  Wifi,
  WifiOff,
  Plus,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  CheckSquare,
  Square,
  RefreshCw,
  Radio,
  History,
  FileText,
  Globe,
  Megaphone,
  Images,
  X,
  ChevronRight,
  ShieldAlert,
  Lock,
  CheckCircle,
  Copy,
  ExternalLink,
  Loader2
} from 'lucide-react';
import {
  TVConfig,
  ScreenGroup,
  ScreenDevice,
  PublishTargetType,
  PublishHistoryItem,
  ZoneConfig
} from '../types';
import { useToast } from './Toast';
import {
  fetchFirestoreState,
  approveScreenFirestore,
  revokeScreenFirestore,
  upsertScreenFirestore,
  deleteScreenFirestore,
  upsertGroupFirestore,
  deleteGroupFirestore,
  publishConfigFirestore,
  subscribeGroupsFirestore,
  subscribeScreensFirestore,
} from '../lib/firebaseStore';

interface ScreenGroupManagerProps {
  formData: TVConfig;
  setFormData: React.Dispatch<React.SetStateAction<TVConfig>>;
  currentUser?: { email: string; role: 'admin' | 'operator'; name: string } | null;
}

export const ScreenGroupManager: React.FC<ScreenGroupManagerProps> = ({
  formData,
  setFormData,
  currentUser,
}) => {
  const { toast } = useToast();
  const user = currentUser || { email: 'admin', role: 'admin', name: 'Quản trị viên (Admin)' };

  const [groups, setGroups] = useState<ScreenGroup[]>([]);
  const [screens, setScreens] = useState<ScreenDevice[]>([]);
  const [publishHistory, setPublishHistory] = useState<PublishHistoryItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 3 Primary Tabs for extreme clarity
  const [activeTab, setActiveTab] = useState<'broadcast' | 'devices' | 'history'>('broadcast');

  // Sub-tab inside Device Manager: Clean 2-tab view (Approved screens & Groups)
  const [deviceSubTab, setDeviceSubTab] = useState<'approved' | 'groups'>('approved');

  // Add/Edit Group Modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ScreenGroup | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupCodeInput, setGroupCodeInput] = useState('');
  const [groupDescInput, setGroupDescInput] = useState('');
  const [groupBuildingIdInput, setGroupBuildingIdInput] = useState('building-a');

  // Add & Approve / Edit Screen Modal
  const [showScreenModal, setShowScreenModal] = useState(false);
  const [editingScreen, setEditingScreen] = useState<ScreenDevice | null>(null);
  const [screenIdInput, setScreenIdInput] = useState('');
  const [screenNameInput, setScreenNameInput] = useState('');
  const [screenGroupIdInput, setScreenGroupIdInput] = useState('');
  const [screenZoneInput, setScreenZoneInput] = useState<'cabin' | 'lobby'>('lobby');
  const [screenBuildingIdInput, setScreenBuildingIdInput] = useState('building-a');
  const [screenIpInput, setScreenIpInput] = useState('');

  // Saving / Loading States to prevent duplicate form submissions
  const [isSavingScreen, setIsSavingScreen] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  // Targeted Broadcast Selection State
  const [publishTargetType, setPublishTargetType] = useState<PublishTargetType>('groups');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);

  // Broadcast Content Inputs
  const [publishTitle, setPublishTitle] = useState('Gửi thông báo khẩn ở chân trang');
  const [overrideMarquee, setOverrideMarquee] = useState(formData.marqueeText || '');

  // Result Notification
  const [publishNotice, setPublishNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Confirmation Modal States (replacing window.confirm which can be blocked in iframes)
  const [screenToDelete, setScreenToDelete] = useState<string | null>(null);
  const [screenToRevoke, setScreenToRevoke] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

  // Sync state with server & Firestore
  const fetchServerState = React.useCallback(async () => {
    setIsRefreshing(true);
    let synced = false;
    try {
      const resp = await fetch('/api/screens/state');
      const contentType = resp.headers.get('content-type');
      if (resp.ok && contentType && contentType.includes('application/json')) {
        const data = await resp.json();
        if (data && data.ok) {
          if (data.groups) {
            setGroups(data.groups);
            setFormData((prev) => ({ ...prev, screenGroups: data.groups }));
          }
          if (data.screens) {
            setScreens(data.screens);
          }
          if (data.publishHistory) setPublishHistory(data.publishHistory);

          if (!hasInitializedSelection && data.groups?.length > 0) {
            setSelectedGroupIds([data.groups[0].id]);
            setHasInitializedSelection(true);
          }
          synced = true;
        }
      }
    } catch {
      // API endpoint not available or network error (e.g. static hosting)
    }

    if (!synced) {
      try {
        const fsState = await fetchFirestoreState();
        if (fsState.groups) {
          setGroups(fsState.groups);
          setFormData((prev) => ({ ...prev, screenGroups: fsState.groups }));
        }
        if (fsState.screens) {
          const now = Date.now();
          setScreens(fsState.screens.map((scr) => {
            const lastSeenTime = typeof scr.lastSeen === 'number' ? scr.lastSeen : (scr.lastSeen ? new Date(scr.lastSeen).getTime() : 0);
            return {
              ...scr,
              status: (now - lastSeenTime < 60000) ? 'online' : 'offline',
            };
          }));
        }
        if (fsState.history?.length > 0) setPublishHistory(fsState.history);
        if (!hasInitializedSelection && fsState.groups?.length > 0) {
          setSelectedGroupIds([fsState.groups[0].id]);
          setHasInitializedSelection(true);
        }
      } catch (fsErr) {
        console.warn('Firestore fallback sync state notice:', fsErr);
      }
    }
    setIsRefreshing(false);
  }, [hasInitializedSelection, setFormData]);

  // Direct Firestore Refresh with User Toast Notification
  const handleDirectFirestoreRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 1. Direct Firestore fetch to guarantee 100% true database state
      const fsState = await fetchFirestoreState();
      if (fsState.groups && fsState.groups.length > 0) {
        setGroups(fsState.groups);
        setFormData((prev) => ({ ...prev, screenGroups: fsState.groups }));
      }
      const now = Date.now();
      const mappedScreens = (fsState.screens || []).map((scr) => {
        const lastSeenTime = typeof scr.lastSeen === 'number' ? scr.lastSeen : (scr.lastSeen ? new Date(scr.lastSeen).getTime() : 0);
        return {
          ...scr,
          approved: scr.approved !== false,
          status: (now - lastSeenTime < 60000) ? 'online' : 'offline',
        };
      });
      setScreens(mappedScreens);
      if (fsState.history) setPublishHistory(fsState.history);

      // 2. Trigger server reload to sync in-memory cache
      try {
        await fetch('/api/screens/state');
      } catch {}

      toast.success(`Đã làm mới danh sách thiết bị từ Database (${mappedScreens.length} màn hình, ${fsState.groups.length} nhóm)`);
    } catch (e) {
      console.error('Lỗi làm mới dữ liệu:', e);
      toast.error('Lỗi khi làm mới dữ liệu từ Database.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let unsubGroups: any;
    let unsubScreens: any;

    const subscribe = () => {
      unsubGroups = subscribeGroupsFirestore((fsGroups) => {
        if (fsGroups && fsGroups.length > 0) {
          setGroups(fsGroups);
          setFormData((prev) => ({ ...prev, screenGroups: fsGroups }));
          if (!hasInitializedSelection) {
            setSelectedGroupIds([fsGroups[0].id]);
            setHasInitializedSelection(true);
          }
        }
      });

      unsubScreens = subscribeScreensFirestore((fsScreens) => {
        if (fsScreens) {
          const now = Date.now();
          setScreens(
            fsScreens.map((scr) => {
              const lastSeenTime = typeof scr.lastSeen === 'number' ? scr.lastSeen : (scr.lastSeen ? new Date(scr.lastSeen).getTime() : 0);
              return {
                ...scr,
                status: (now - lastSeenTime < 60000) ? 'online' : 'offline',
              };
            })
          );
        }
      });
    };

    const unsubscribe = () => {
      if (unsubGroups) unsubGroups();
      if (unsubScreens) unsubScreens();
    };

    // Initial subscription
    fetchServerState();
    subscribe();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        unsubscribe();
      } else {
        // Refresh immediately on visibility to ensure stale data isn't shown
        fetchServerState();
        subscribe();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe();
    };
  }, [fetchServerState, hasInitializedSelection, setFormData]);

  // Manual refresh helper
  const triggerManualRefresh = () => {
    handleDirectFirestoreRefresh();
  };

  // Update override states when parent formData changes
  useEffect(() => {
    setOverrideMarquee(formData.marqueeText || '');
  }, [formData.marqueeText]);

  // Open Add Group
  const handleOpenAddGroup = (defaultBuildingId?: string) => {
    setEditingGroup(null);
    setGroupNameInput('');
    setGroupCodeInput(`GRP_NHOM_${groups.length + 1}`);
    setGroupDescInput('');
    setGroupBuildingIdInput(
      defaultBuildingId || formData.selectedBuildingId || formData.buildings?.[0]?.id || 'building-a'
    );
    setShowGroupModal(true);
  };

  // Open Edit Group
  const handleOpenEditGroup = (grp: ScreenGroup) => {
    setEditingGroup(grp);
    setGroupNameInput(grp.name);
    setGroupCodeInput(grp.code);
    setGroupDescInput(grp.description || '');
    setGroupBuildingIdInput(
      grp.buildingId || formData.selectedBuildingId || formData.buildings?.[0]?.id || 'building-a'
    );
    setShowGroupModal(true);
  };

  // Open Add Screen Modal
  const handleOpenAddScreen = () => {
    setEditingScreen(null);
    setScreenIdInput('');
    setScreenNameInput('');
    setScreenGroupIdInput(groups[0]?.id || '');
    setScreenZoneInput('lobby');
    setScreenBuildingIdInput(formData.selectedBuildingId || formData.buildings?.[0]?.id || 'building-a');
    setScreenIpInput('192.168.1.100');
    setShowScreenModal(true);
  };

  // Open Edit Screen Modal
  const handleOpenEditScreen = (scr: ScreenDevice) => {
    setEditingScreen(scr);
    setScreenIdInput(scr.id);
    setScreenNameInput(scr.name);
    setScreenGroupIdInput(scr.groupId);
    setScreenZoneInput(scr.zone || 'lobby');
    setScreenBuildingIdInput(scr.buildingId || formData.selectedBuildingId || 'building-a');
    setScreenIpInput(scr.ipAddress || '192.168.1.100');
    setShowScreenModal(true);
  };

  // Handle Save Group
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingGroup) return;
    if (!groupNameInput.trim() || !groupCodeInput.trim()) return;

    setIsSavingGroup(true);
    try {
      const grpId = editingGroup ? editingGroup.id : `grp-${Date.now().toString().slice(-4)}`;
      const grp: ScreenGroup = {
        id: grpId,
        name: groupNameInput.trim(),
        code: groupCodeInput.trim().toUpperCase(),
        description: groupDescInput.trim(),
        buildingId: groupBuildingIdInput || formData.selectedBuildingId || 'building-a',
      };

      // 1. Optimistic UI update
      setGroups((prev) => {
        const idx = prev.findIndex((g) => g.id === grpId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = grp;
          return updated;
        }
        return [...prev, grp];
      });

      setFormData((prev) => {
        const existing = prev.screenGroups || [];
        const idx = existing.findIndex((g) => g.id === grpId);
        let updated;
        if (idx >= 0) {
          updated = [...existing];
          updated[idx] = grp;
        } else {
          updated = [...existing, grp];
        }
        return { ...prev, screenGroups: updated };
      });

      // 2. Immediately close modal
      setShowGroupModal(false);
      setEditingGroup(null);
      setGroupNameInput('');
      setGroupCodeInput('');
      setGroupDescInput('');
      toast.success(editingGroup ? 'Cập nhật nhóm màn hình thành công!' : 'Thêm nhóm màn hình mới thành công!');

      // 3. Background sync
      upsertGroupFirestore(grp).catch(() => {});
      fetch('/api/screens/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(grp),
      }).catch(() => {});
    } catch (e) {
      console.error('Lỗi lưu nhóm:', e);
      toast.error('Có lỗi xảy ra khi lưu nhóm màn hình');
    } finally {
      setIsSavingGroup(false);
    }
  };

  // Handle Delete Group
  const handleDeleteGroup = async (id: string) => {
    setGroupToDelete(id);
  };

  const executeDeleteGroup = async (id: string) => {
    try {
      // Direct Firestore deletion
      await deleteGroupFirestore(id);

      // Optional API sync
      try {
        const resp = await fetch(`/api/screens/groups/${id}`, { method: 'DELETE' });
        const contentType = resp.headers.get('content-type');
        if (resp.ok && contentType && contentType.includes('application/json')) {
          const data = await resp.json();
          if (data && data.ok && data.groups) {
            setGroups(data.groups);
          }
        }
      } catch {}

      await fetchServerState();
    } catch (e) {
      console.error('Lỗi xóa nhóm:', e);
    }
  };

  // Handle Save Screen (Add & Approve or Update)
  const handleSaveScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingScreen) return;
    if (!screenNameInput.trim() || !screenGroupIdInput) return;

    let cleanId = (editingScreen ? editingScreen.id : (screenIdInput.trim() || `SCR-${Date.now().toString(36).slice(-5).toUpperCase()}`)).toUpperCase();
    if (!cleanId.startsWith('SCR-') && !editingScreen) {
      cleanId = `SCR-${cleanId}`;
    }

    const scrName = screenNameInput.trim();
    const bldId = screenBuildingIdInput || formData.selectedBuildingId || 'building-a';
    const zone = screenZoneInput;
    const ip = screenIpInput.trim() || '192.168.1.100';

    setIsSavingScreen(true);
    try {
      const updatedScreen: ScreenDevice = {
        id: cleanId,
        name: scrName,
        groupId: screenGroupIdInput,
        buildingId: bldId,
        zone: zone,
        ipAddress: ip,
        status: editingScreen?.status || 'online',
        lastSeen: editingScreen?.lastSeen || Date.now(),
        approved: true,
        resolution: editingScreen?.resolution || (zone === 'cabin' ? '1080x1920 (9:16)' : '1920x1080 (16:9)'),
      };

      // 1. Optimistic UI update
      setScreens((prev) => {
        const exists = prev.some((scr) => scr.id === cleanId);
        if (exists) {
          return prev.map((scr) => (scr.id === cleanId ? updatedScreen : scr));
        }
        return [...prev, updatedScreen];
      });

      // 2. Immediately close modal and notify user
      setShowScreenModal(false);
      setEditingScreen(null);
      setScreenIdInput('');
      setScreenNameInput('');
      setScreenIpInput('');
      toast.success(
        editingScreen
          ? `Đã cập nhật thông tin màn hình ${cleanId}!`
          : `🎉 Đã thêm và phê duyệt thành công thiết bị: ${cleanId}!`
      );

      // 3. Direct Firestore sync
      await approveScreenFirestore(cleanId, scrName, screenGroupIdInput, bldId, zone);
      await upsertScreenFirestore(updatedScreen);

      // 4. Background API sync
      fetch('/api/screens/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedScreen),
      }).catch(() => {});
    } catch (e) {
      console.error('Lỗi lưu thiết bị:', e);
      toast.error('Có lỗi xảy ra khi lưu thiết bị. Vui lòng thử lại.');
    } finally {
      setIsSavingScreen(false);
    }
  };

  // Handle Revoke Screen Approval
  const handleRevokeScreen = async (screenId: string) => {
    setScreenToRevoke(screenId);
  };

  const executeRevokeScreen = async (screenId: string) => {
    try {
      // Direct Firestore revocation
      await revokeScreenFirestore(screenId);

      // Optional API sync
      try {
        await fetch('/api/screens/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screenId }),
        });
      } catch {}

      await handleDirectFirestoreRefresh();
      toast.info(`Đã khóa thành công màn hình ${screenId}.`);
    } catch (e) {
      console.error('Lỗi thu hồi quyền thiết bị:', e);
      toast.error(`Lỗi khi khóa thiết bị ${screenId}. Vui lòng thử lại.`);
    }
  };

  // Handle Delete Screen
  const handleDeleteScreen = async (id: string) => {
    setScreenToDelete(id);
  };

  const executeDeleteScreen = async (id: string) => {
    // 1. Optimistic UI Update (instant removal from UI)
    setScreens((prev) => prev.filter((scr) => scr.id !== id));
    setScreenToDelete(null);

    try {
      // 2. Direct Firestore deletion
      await deleteScreenFirestore(id);

      // 3. API sync
      try {
        await fetch(`/api/screens/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch {}

      toast.success(`Đã xóa vĩnh viễn màn hình ${id} khỏi cơ sở dữ liệu.`);
    } catch (e) {
      console.error('Lỗi xóa thiết bị:', e);
      // Rollback on error
      await handleDirectFirestoreRefresh();
      toast.error(`Lỗi khi xóa thiết bị ${id}. Vui lòng thử lại.`);
    }
  };

  // Calculate Affected vs Unaffected Screens
  const getAffectedScreens = () => {
    if (publishTargetType === 'all') return screens;
    if (publishTargetType === 'groups') {
      const setG = new Set(selectedGroupIds);
      return screens.filter((s) => setG.has(s.groupId));
    }
    if (publishTargetType === 'screens') {
      const setS = new Set(selectedScreenIds);
      return screens.filter((s) => setS.has(s.id));
    }
    return [];
  };

  const affectedScreens = getAffectedScreens();
  const affectedScreenIds = new Set(affectedScreens.map((s) => s.id));
  const unaffectedScreens = screens.filter((s) => !affectedScreenIds.has(s.id));

  // Calculate targeted slides for the selected group / screens
  const getTargetedSlides = () => {
    const allSlides = formData.slides || [];
    if (publishTargetType === 'all') return allSlides;
    if (publishTargetType === 'groups') {
      if (selectedGroupIds.length === 0) return allSlides;
      const selectedSet = new Set(selectedGroupIds);
      return allSlides.filter(
        (s) =>
          s.targetScope !== 'groups' ||
          !s.targetGroupIds ||
          s.targetGroupIds.length === 0 ||
          s.targetGroupIds.some((gid) => selectedSet.has(gid))
      );
    }
    return allSlides;
  };

  const targetedSlides = getTargetedSlides();

  // Handle Targeted Broadcast ("Phát Tin")
  const handlePublishContent = async () => {
    if (affectedScreens.length === 0) {
      setPublishNotice({
        type: 'error',
        message: 'Vui lòng chọn ít nhất 1 nhóm hoặc 1 màn hình để phát tin.',
      });
      return;
    }

    setIsPublishing(true);
    setPublishNotice(null);

    const publishConfig: Partial<ZoneConfig> = {
      marqueeText: overrideMarquee,
      showMarquee: true,
    };

    try {
      const historyItem: PublishHistoryItem = {
        id: `pub-${Date.now()}`,
        timestamp: new Date().toLocaleString('vi-VN'),
        title: publishTitle,
        targetType: publishTargetType,
        targetGroupNames: publishTargetType === 'all'
          ? ['Tất cả']
          : groups.filter(g => selectedGroupIds.includes(g.id)).map(g => g.name),
        affectedScreenCount: affectedScreens.length,
        config: publishConfig,
        publisherEmail: currentUser?.email || 'admin@btc.gov.vn',
        publisherName: currentUser?.name || 'Administrator',
      };

      // Direct Firestore persistence
      await publishConfigFirestore(affectedScreens, publishConfig, historyItem);

      // Optional API sync if endpoint exists
      try {
        const resp = await fetch('/api/screens/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetType: publishTargetType,
            targetGroupIds: selectedGroupIds,
            targetScreenIds: selectedScreenIds,
            title: publishTitle,
            config: publishConfig,
            publisherEmail: currentUser?.email,
            publisherName: currentUser?.name,
          }),
        });

        const contentType = resp.headers.get('content-type');
        if (resp.ok && contentType && contentType.includes('application/json')) {
          const data = await resp.json();
          if (data && data.ok && data.screens) {
            setScreens(data.screens);
          }
        }
      } catch {}

      setPublishNotice({
        type: 'success',
        message: `Đã phát tin thành công tới ${affectedScreens.length} màn hình!`,
      });
      setPublishHistory([historyItem, ...publishHistory]);
    } catch (err: any) {
      setPublishNotice({
        type: 'error',
        message: 'Lỗi phát tin: ' + err.message,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const onlineScreensCount = screens.filter((s) => s.status === 'online').length;

  return (
    <div className="space-y-5 text-slate-100">
      {/* HEADER BAR: STATUS & MAIN TABS */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
                Đẩy Thông Tin & Quản Lý Màn Hình Theo Nhóm
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Phát tin tức, trang web và slide ảnh trực tiếp đến từng nhóm hoặc từng màn hình cụ thể.
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span className="text-slate-300 font-medium">
                <strong className="text-emerald-400 font-bold">{onlineScreensCount}</strong>/{screens.length} Online
              </span>
            </div>

            <button
              onClick={fetchServerState}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all text-xs flex items-center gap-1.5"
              title="Cập nhật trạng thái"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Làm mới</span>
            </button>
          </div>
        </div>

        {/* 3 SCIENTIFIC NAVIGATION TABS */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'broadcast'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Send className="w-4 h-4" /> 1. Phát Tin Ngay Cho Màn Hình
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'devices'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" /> 2. Danh Sách Thiết Bị & Nhóm
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" /> 3. Nhật Ký Phát Tin
          </button>
        </div>
      </div>

      {/* TAB 1: PHÁT TIN NGAY (2-COLUMN SPLIT VIEW) */}
      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* CỘT BÊN TRÁI: CHỌN NƠI PHÁT (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-mono">1</span>
                  Chọn Màn Hình Nhận Tin
                </span>
                <span className="text-[11px] text-slate-400">
                  Đã chọn: <strong className="text-cyan-400">{affectedScreens.length}</strong> màn
                </span>
              </div>

              {/* Target Mode Toggle */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setPublishTargetType('groups')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all ${
                    publishTargetType === 'groups'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Theo Nhóm
                </button>

                <button
                  type="button"
                  onClick={() => setPublishTargetType('screens')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all ${
                    publishTargetType === 'screens'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Màn Hình Lẻ
                </button>

                <button
                  type="button"
                  onClick={() => setPublishTargetType('all')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all ${
                    publishTargetType === 'all'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Tất Cả
                </button>
              </div>

              {/* MODE 1: CHỌN THEO NHÓM MÀN HÌNH */}
              {publishTargetType === 'groups' && (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  <div className="flex items-center justify-between px-1 pb-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const allGroupIds = groups.map((g) => g.id);
                        const isAllSelected = allGroupIds.length > 0 && allGroupIds.every((gid) => selectedGroupIds.includes(gid));
                        setSelectedGroupIds(isAllSelected ? [] : allGroupIds);
                      }}
                      className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      {groups.length > 0 && groups.every((g) => selectedGroupIds.includes(g.id)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả các nhóm màn hình'}
                    </button>
                    <span className="text-[10px] text-slate-400">
                      Đã chọn {selectedGroupIds.length}/{groups.length} nhóm
                    </span>
                  </div>
                  {groups.map((grp) => {
                    const isSelected = selectedGroupIds.includes(grp.id);
                    const grpScreens = screens.filter((s) => s.groupId === grp.id);
                    const onlineCount = grpScreens.filter((s) => s.status === 'online').length;

                    return (
                      <div
                        key={grp.id}
                        onClick={() => {
                          if (isSelected) setSelectedGroupIds(selectedGroupIds.filter((id) => id !== grp.id));
                          else setSelectedGroupIds([...selectedGroupIds, grp.id]);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-500/70 text-white shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                          <div>
                            <div className="text-xs font-bold">{grp.name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{grp.description || 'Không mô tả'}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                            {onlineCount}/{grpScreens.length} Online
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MODE 2: CHỌN TỪNG MÀN HÌNH ĐƠN LẺ */}
              {publishTargetType === 'screens' && (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {screens.map((scr) => {
                    const isSelected = selectedScreenIds.includes(scr.id);

                    return (
                      <div
                        key={scr.id}
                        onClick={() => {
                          if (isSelected) setSelectedScreenIds(selectedScreenIds.filter((id) => id !== scr.id));
                          else setSelectedScreenIds([...selectedScreenIds, scr.id]);
                        }}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-500/70 text-white shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                          <div>
                            <div className="font-semibold text-slate-200">{scr.name}</div>
                            <div className="text-[10px] text-slate-400">IP: {scr.ipAddress}</div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                            scr.status === 'online'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${scr.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                          {scr.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MODE 3: TẤT CẢ MÀN HÌNH */}
              {publishTargetType === 'all' && (
                <div className="p-3 bg-cyan-950/20 border border-cyan-500/30 rounded-xl text-xs text-cyan-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  Nội dung sẽ được phát đồng bộ lên toàn bộ <strong>{screens.length} màn hình</strong> trong hệ thống.
                </div>
              )}

              {/* TÓM TẮT PHÂN BỔ MÀN HÌNH */}
              <div className="pt-2 border-t border-slate-800 text-[11px] space-y-1">
                <div className="flex justify-between text-emerald-400">
                  <span>Màn hình sẽ ĐỔI NỘI DUNG MỚI:</span>
                  <strong>{affectedScreens.length} thiết bị</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Màn hình GIỮ NGUYÊN NỘI DUNG CŨ:</span>
                  <strong>{unaffectedScreens.length} thiết bị</strong>
                </div>
              </div>
            </div>
          </div>

          {/* CỘT BÊN PHẢI: SOẠN & PHÁT NỘI DUNG (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-mono">2</span>
                  Gửi Thông Báo Chữ Chạy (Chân Trang TV)
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full normal-case">
                  Không ghi đè Lịch họp & Slideshow ảnh
                </span>
              </div>

              {/* Informative Help Alert */}
              <div className="p-3 bg-amber-950/20 border border-amber-900/60 rounded-xl text-xs text-amber-200/90 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-400">
                  <Megaphone className="w-4 h-4 shrink-0" /> Chế độ Gửi Thông Báo Nhanh
                </p>
                <p className="text-[11px] leading-relaxed">
                  Tính năng này chỉ cập nhật/ghi đè <strong>Dòng chữ chạy ngang chân TV (Marquee)</strong> và bật nó lên ngay lập tức cho các thiết bị được chọn. Lịch họp (URL) và Slideshow ảnh hiện tại của màn hình vẫn sẽ được giữ nguyên mà không bị ảnh hưởng.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tên đợt phát tin (Ghi chú nội bộ):
                  </label>
                  <input
                    type="text"
                    value={publishTitle}
                    onChange={(e) => setPublishTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-cyan-400 outline-none"
                    placeholder="e.g. Phát thông báo khẩn cấp ngày..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Megaphone className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-bold text-slate-200">Nội Dung Chữ Chạy (Thông báo khẩn):</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {overrideMarquee.length} ký tự
                    </span>
                  </label>
                  <textarea
                    rows={4}
                    value={overrideMarquee}
                    onChange={(e) => setOverrideMarquee(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 text-xs focus:ring-2 focus:ring-cyan-500 outline-none leading-relaxed"
                    placeholder="Nhập dòng chữ chạy ngang chân màn hình TV nhận thông báo này..."
                  />
                </div>
              </div>

              {/* Notification Banner */}
              {publishNotice && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                    publishNotice.type === 'success'
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                  }`}
                >
                  {publishNotice.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                  <div>{publishNotice.message}</div>
                </div>
              )}

              {/* ACTION BUTTON */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePublishContent}
                  disabled={isPublishing || affectedScreens.length === 0}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01]"
                >
                  {isPublishing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Đang phát tin tới màn hình...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> PHÁT TIN TỚI {affectedScreens.length} MÀN HÌNH ĐÃ CHỌN
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DANH SÁCH THIẾT BỊ & NHÓM */}
      {activeTab === 'devices' && (
        <div className="space-y-4">

          {/* Sub-tab Navigation & Actions Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
            <div className="flex gap-2">
              <button
                onClick={() => setDeviceSubTab('approved')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  deviceSubTab === 'approved'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Màn Hình Đã Duyệt ({screens.length})
              </button>
              <button
                onClick={() => setDeviceSubTab('groups')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  deviceSubTab === 'groups'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Nhóm Màn Hình ({groups.length})
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {/* Nút Làm Mới Dữ Liệu từ Database */}
              <button
                type="button"
                onClick={handleDirectFirestoreRefresh}
                disabled={isRefreshing}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 font-bold text-xs flex items-center gap-2 cursor-pointer border border-slate-700 shadow-sm transition-all disabled:opacity-50"
                title="Đồng bộ trực tiếp với Database Firestore để loại bỏ màn hình rác / ghost devices"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
                <span>{isRefreshing ? 'Đang Tải...' : 'Làm Mới Dữ Liệu'}</span>
              </button>

              {user.role === 'admin' && (
                <>
                  {deviceSubTab === 'approved' && (
                    <button
                      type="button"
                      onClick={handleOpenAddScreen}
                      className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Thêm & Duyệt Thiết Bị
                    </button>
                  )}

                  {deviceSubTab === 'groups' && (
                    <button
                      type="button"
                      onClick={() => handleOpenAddGroup()}
                      className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Tạo Nhóm Mới
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* SUBTAB 1: MÀN HÌNH ĐÃ DUYỆT */}
          {deviceSubTab === 'approved' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
              {screens.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-4">
                  <Monitor className="w-12 h-12 text-slate-700 mx-auto mb-1" />
                  <div>
                    <p className="font-bold text-slate-400 text-sm">Chưa có thiết bị màn hình nào</p>
                    <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                      Hệ thống đang hoạt động theo phương án duyệt thủ công. Bấm nút <strong>&quot;Thêm & Duyệt Thiết Bị&quot;</strong> ở góc phải để khai báo và phê duyệt thiết bị TV mới.
                    </p>
                  </div>
                  {user.role === 'admin' && (
                    <button
                      type="button"
                      onClick={handleOpenAddScreen}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Thêm & Duyệt Thiết Bị Ngay
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800 tracking-wider">
                    <tr>
                      <th className="p-3">Mã Thiết Bị (ID) & Tên</th>
                      <th className="p-3">Thuộc Nhóm</th>
                      <th className="p-3">Khu Vực (Zone)</th>
                      <th className="p-3">Địa Chỉ IP</th>
                      <th className="p-3">Trạng Thái</th>
                      <th className="p-3 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {screens.map((scr) => {
                      const grp = groups.find((g) => g.id === scr.groupId);
                      return (
                        <tr key={scr.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 font-semibold text-white">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-100">{scr.name}</span>
                              <span className="text-[11px] text-cyan-400 font-mono font-bold tracking-wider">{scr.id}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-cyan-300 font-medium border border-slate-800 text-[11px]">
                              {grp?.name || scr.groupId}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                              scr.zone === 'cabin' 
                                ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60' 
                                : 'bg-blue-950/60 text-blue-300 border border-blue-800/60'
                            }`}>
                              {scr.zone === 'cabin' ? '🛗 Trong Cabin (9:16)' : '🏢 Ngoài Sảnh (16:9)'}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-400">{scr.ipAddress || '192.168.1.100'}</td>
                          <td className="p-3">
                            {scr.status === 'online' ? (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Online
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 inline-block">
                                Offline
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  window.open(`/?screenId=${scr.id}&view=display`, '_blank');
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                                title="Mở màn hình TV này trong một tab trình duyệt mới để xem trực tiếp"
                              >
                                <ExternalLink className="w-3 h-3 text-cyan-400" />
                                <span>Xem TV</span>
                              </button>

                              {user.role === 'admin' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditScreen(scr)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
                                    title="Sửa thông tin màn hình"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteScreen(scr.id)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 border border-slate-700 transition-colors cursor-pointer"
                                    title="Xóa vĩnh viễn màn hình khỏi hệ thống"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* SUBTAB 2: NHÓM */}
          {deviceSubTab === 'groups' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Quản Lý Nhóm Màn Hình ({groups.length} nhóm)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Phân nhóm màn hình theo Tòa nhà & Vị trí để phát nội dung tập trung.
                  </p>
                </div>

                {user.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleOpenAddGroup()}
                    className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 cursor-pointer transition-all"
                  >
                    <Plus className="w-4 h-4" /> Thêm Nhóm Màn Hình Mới
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groups.map((grp) => {
                  const count = screens.filter((s) => s.groupId === grp.id).length;
                  const bld = (formData.buildings || []).find((b) => b.id === grp.buildingId);
                  const isCabin = grp.code?.toLowerCase().includes('cabin') || grp.name?.toLowerCase().includes('cabin');
                  return (
                    <div key={grp.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white">{grp.name}</span>
                          <span className="px-2.5 py-0.5 text-[10px] font-bold bg-cyan-950/40 text-cyan-400 rounded-lg border border-cyan-800/40">
                            {isCabin ? '🛗 Màn dọc Cabin (9:16)' : '🏢 Màn ngang Sảnh (16:9)'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{grp.description || 'Chưa có mô tả'}</p>
                        
                        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
                          <span className="px-2.5 py-0.5 rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-semibold text-[11px]">
                            🏢 Tòa nhà: {bld ? bld.name : 'Chưa gán tòa nhà'}
                          </span>
                          <span className="text-slate-400">
                            <strong className="text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{count} màn hình</strong>
                          </span>
                        </div>
                      </div>

                      {user.role === 'admin' ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditGroup(grp)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 transition-colors"
                            title="Sửa thông tin nhóm"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(grp.id)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-rose-950 text-rose-400 transition-colors"
                            title="Xóa nhóm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[10px] italic">Khóa</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: NHẬT KÝ PHÁT TIN */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" /> Nhật Ký Đẩy Tin
          </h4>

          {publishHistory.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center italic">Chưa có lịch sử phát tin nào</p>
          ) : (
            <div className="space-y-2">
              {publishHistory.map((item) => (
                <div key={item.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>{item.configSnapshot?.title || 'Đợt phát tin'}</span>
                      <span className="px-2 py-0.5 text-[10px] rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                        {item.targetSummary}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex flex-col gap-1.5 items-start">
                      <span>Thời gian: {item.publishedAt} • Áp dụng cho: <strong>{item.affectedScreensCount} màn hình</strong></span>
                      {item.publisherEmail && (
                        <span className="text-[10px] text-cyan-400 font-medium bg-cyan-950/40 border border-cyan-800/30 rounded-lg px-2.5 py-1">
                          Người thực hiện: <strong className="text-cyan-300">{item.publisherName}</strong> ({item.publisherEmail})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: THÊM / SỬA NHÓM */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                {editingGroup ? 'Chỉnh Sửa Nhóm Màn Hình' : 'Thêm Nhóm Màn Hình Mới'}
              </h4>
              <button onClick={() => setShowGroupModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tên nhóm màn hình:</label>
                <input
                  type="text"
                  required
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
                  placeholder="e.g. Sảnh Thang Máy Trụ Sở 28 THĐ"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tòa nhà sở thuộc:</label>
                <select
                  value={groupBuildingIdInput}
                  onChange={(e) => setGroupBuildingIdInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 text-xs outline-none focus:border-cyan-400 font-medium"
                >
                  {(formData.buildings && formData.buildings.length > 0 ? formData.buildings : [
                    { id: 'building-a', name: 'Trụ Sở 28 Trần Hưng Đạo', code: '28THD' },
                    { id: 'building-b', name: 'Trụ Sở 6-8 Phan Huy Chú', code: '68PHC' }
                  ]).map((bld) => (
                    <option key={bld.id} value={bld.id}>
                      🏢 {bld.name} ({bld.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mã nhóm (định danh):</label>
                <input
                  type="text"
                  required
                  value={groupCodeInput}
                  onChange={(e) => setGroupCodeInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 text-xs outline-none focus:border-cyan-400 font-mono uppercase"
                  placeholder="e.g. GRP_SANH_28THD"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mô tả vị trí:</label>
                <input
                  type="text"
                  value={groupDescInput}
                  onChange={(e) => setGroupDescInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-cyan-400"
                  placeholder="e.g. Màn hình sảnh tầng 1 Trụ sở 28 THĐ"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSavingGroup}
                  onClick={() => setShowGroupModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingGroup}
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-500/20"
                >
                  {isSavingGroup ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang Lưu...</span>
                    </>
                  ) : (
                    <span>Lưu Nhóm</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: THÊM & DUYỆT HOẶC CHỈNH SỬA MÀN HÌNH */}
      {showScreenModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Monitor className="w-4 h-4 text-cyan-400" />
                {editingScreen ? 'Chỉnh Sửa Thông Tin Màn Hình' : 'Thêm & Phê Duyệt Thiết Bị Mới'}
              </h4>
              <button 
                onClick={() => !isSavingScreen && setShowScreenModal(false)} 
                disabled={isSavingScreen}
                className="text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveScreen} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Mã thiết bị (Device ID trên TV):
                </label>
                {editingScreen ? (
                  <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400 font-mono text-xs font-bold flex items-center justify-between">
                    <span>{editingScreen.id}</span>
                    <span className="text-[10px] text-slate-500 font-sans font-normal">Mã cố định</span>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      disabled={isSavingScreen}
                      value={screenIdInput}
                      onChange={(e) => setScreenIdInput(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-cyan-400 font-mono font-bold text-xs outline-none focus:border-cyan-400 disabled:opacity-60"
                      placeholder="VD: SCR-04NU9 (Để trống hệ thống sẽ tự tạo mã)"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Nhập mã đang hiển thị trên màn hình TV của bạn hoặc để trống để sinh mã tự động.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tên thiết bị / Vị trí hiển thị:</label>
                <input
                  type="text"
                  required
                  disabled={isSavingScreen}
                  value={screenNameInput}
                  onChange={(e) => setScreenNameInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400 disabled:opacity-60"
                  placeholder="e.g. Màn Hình Sảnh - Trụ Sở 28 THĐ"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Thuộc nhóm màn hình:</label>
                <select
                  disabled={isSavingScreen}
                  value={screenGroupIdInput}
                  onChange={(e) => setScreenGroupIdInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 text-xs outline-none focus:border-cyan-400 disabled:opacity-60 cursor-pointer"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Vị trí lắp đặt (Zone):</label>
                <select
                  disabled={isSavingScreen}
                  value={screenZoneInput}
                  onChange={(e) => setScreenZoneInput(e.target.value as 'cabin' | 'lobby')}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-cyan-400 disabled:opacity-60 cursor-pointer"
                >
                  <option value="lobby">🏢 Ngoài Sảnh Thang (Màn hình ngang 16:9)</option>
                  <option value="cabin">🛗 Trong Cabin Thang (Màn hình dọc 9:16)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tòa nhà / Trụ sở:</label>
                <select
                  disabled={isSavingScreen}
                  value={screenBuildingIdInput}
                  onChange={(e) => setScreenBuildingIdInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-cyan-400 disabled:opacity-60 cursor-pointer"
                >
                  {(formData.buildings || []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Địa chỉ IP:</label>
                <input
                  type="text"
                  disabled={isSavingScreen}
                  value={screenIpInput}
                  onChange={(e) => setScreenIpInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-cyan-400 font-mono disabled:opacity-60"
                  placeholder="e.g. 192.168.1.105"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSavingScreen}
                  onClick={() => setShowScreenModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingScreen}
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-500/20"
                >
                  {isSavingScreen ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang Lưu...</span>
                    </>
                  ) : (
                    <span>{editingScreen ? 'Lưu Thay Đổi' : 'Xác Nhận Thêm & Phê Duyệt'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Screen */}
      {screenToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-full bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Xác nhận xóa màn hình</h3>
                <p className="text-xs text-slate-400">Hành động này không thể hoàn tác</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              Bạn có chắc chắn muốn xóa vĩnh viễn màn hình <strong className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded">[{screenToDelete}]</strong> khỏi hệ thống?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setScreenToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = screenToDelete;
                  setScreenToDelete(null);
                  await executeDeleteScreen(id);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-rose-600/20"
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Revoke Screen */}
      {screenToRevoke && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-3 rounded-full bg-amber-500/10 border border-amber-500/20">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Xác nhận khóa màn hình</h3>
                <p className="text-xs text-slate-400">Thiết bị sẽ chuyển về trạng thái chờ duyệt</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              Bạn có chắc muốn khóa/thu hồi quyền truy cập màn hình <strong className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded">[{screenToRevoke}]</strong>?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setScreenToRevoke(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = screenToRevoke;
                  setScreenToRevoke(null);
                  await executeRevokeScreen(id);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer shadow-lg shadow-amber-600/20"
              >
                Xác nhận khóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Group */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-full bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Xác nhận xóa nhóm</h3>
                <p className="text-xs text-slate-400">Các màn hình thuộc nhóm này sẽ cần được gán lại</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              Bạn có chắc muốn xóa nhóm màn hình này?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = groupToDelete;
                  setGroupToDelete(null);
                  await executeDeleteGroup(id);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-rose-600/20"
              >
                Xóa nhóm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
