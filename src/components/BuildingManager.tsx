import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Monitor,
  Globe,
  Megaphone,
  ChevronsDown,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  Sliders,
  X,
  Loader2
} from 'lucide-react';
import { TVConfig, BuildingItem, LocationZone, ZoneConfig, DisplayOrientation, ScreenGroup } from '../types';
import { upsertGroupFirestore, deleteGroupFirestore } from '../lib/firebaseStore';
import { useToast } from './Toast';

interface BuildingManagerProps {
  formData: TVConfig;
  setFormData: React.Dispatch<React.SetStateAction<TVConfig>>;
  onApplyBuildingZone: (buildingId: string, zone: LocationZone, groupId?: string) => void;
  screenId?: string;
}

export const BuildingManager: React.FC<BuildingManagerProps> = ({
  formData,
  setFormData,
  onApplyBuildingZone,
  screenId,
}) => {
  const { toast } = useToast();

  const currentScreenId = screenId || 
    (typeof window !== 'undefined' ? (sessionStorage.getItem('android_tv_screen_id') || localStorage.getItem('android_tv_screen_id')) : '') || 
    'SCR-LOBBY-A1';
  const currentScreenName = `Màn hình ${currentScreenId}`;

  const [selectedBldId, setSelectedBldId] = useState<string>(
    formData.selectedBuildingId || formData.buildings?.[0]?.id || 'building-a'
  );
  const [selectedZoneType, setSelectedZoneType] = useState<LocationZone>(
    formData.selectedZone || 'lobby'
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    return formData.selectedGroupId || formData.screenGroups?.[0]?.id || '';
  });
  const [activeBuildingEditTab, setActiveBuildingEditTab] = useState<string>(
    formData.selectedBuildingId || formData.buildings?.[0]?.id || 'building-a'
  );
  const [editingZoneMap, setEditingZoneMap] = useState<Record<string, LocationZone>>({});
  const [showAddBuildingModal, setShowAddBuildingModal] = useState(false);
  const [newBldName, setNewBldName] = useState('');
  const [newBldCode, setNewBldCode] = useState('');
  const [newBldDesc, setNewBldDesc] = useState('');
  const [appliedNotice, setAppliedNotice] = useState('');
  const [editingBldId, setEditingBldId] = useState<string | null>(null);

  // Copy modal state
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySource, setCopySource] = useState<{ bldId: string; zone: LocationZone } | null>(null);
  const [copyTargetBldId, setCopyTargetBldId] = useState<string>('');
  const [copyTargetZone, setCopyTargetZone] = useState<LocationZone>('cabin');

  const buildings = formData.buildings || [];

  const currentActiveBuilding = buildings.find((b) => b.id === formData.selectedBuildingId);
  const currentActiveZoneConfig =
    currentActiveBuilding?.[formData.selectedZone === 'cabin' ? 'cabinConfig' : 'lobbyConfig'];

  const getZoneFromGroup = (group: ScreenGroup): LocationZone => {
    if (!group) return 'lobby';
    const nameLower = (group.name || '').toLowerCase();
    const codeLower = (group.code || '').toLowerCase();
    const descLower = (group.description || '').toLowerCase();
    
    if (
      nameLower.includes('cabin') || 
      codeLower.includes('cabin') || 
      descLower.includes('cabin') ||
      nameLower.includes('trong') ||
      codeLower.includes('cab')
    ) {
      return 'cabin';
    }
    return 'lobby';
  };

  const handleGroupSelect = (group: ScreenGroup) => {
    setSelectedGroupId(group.id);
    const inferredZone = getZoneFromGroup(group);
    setSelectedZoneType(inferredZone);
  };

  React.useEffect(() => {
    const buildingGroups = (formData.screenGroups || []).filter(
      (g) => !g.buildingId || g.buildingId === selectedBldId || (formData.buildings?.length === 1)
    );
    if (buildingGroups.length > 0) {
      const hasSelected = buildingGroups.some(g => g.id === selectedGroupId);
      if (!hasSelected) {
        handleGroupSelect(buildingGroups[0]);
      }
    } else {
      setSelectedGroupId(selectedZoneType === 'cabin' ? 'grp-cabin-fallback' : 'grp-lobby-fallback');
    }
  }, [selectedBldId, formData.screenGroups]);

  // Handle apply building zone to current display device
  const handleApplyToDevice = () => {
    onApplyBuildingZone(selectedBldId, selectedZoneType, selectedGroupId);
    const targetBld = buildings.find((b) => b.id === selectedBldId);
    const targetZoneName = selectedZoneType === 'cabin' ? 'Trong Cabin Thang' : 'Ngoài Sảnh Thang';
    const targetGroup = (formData.screenGroups || []).find((g) => g.id === selectedGroupId);
    setAppliedNotice(
      `Đã áp dụng cài đặt của "${targetBld?.name || 'Tòa nhà'}" - [${targetGroup?.name || targetZoneName}] cho màn hình hiện tại!`
    );
    setTimeout(() => setAppliedNotice(''), 4000);
  };

  // Helper to update a building field
  const handleUpdateBuildingInfo = (id: string, field: keyof BuildingItem, value: any) => {
    setFormData((prev) => {
      const updatedBuildings = (prev.buildings || []).map((b) => {
        if (b.id === id) {
          return { ...b, [field]: value };
        }
        return b;
      });
      return { ...prev, buildings: updatedBuildings };
    });
  };

  // Helper to update zone config inside a building
  const handleUpdateZone = (
    bldId: string,
    zoneKey: LocationZone,
    field: keyof ZoneConfig,
    value: any
  ) => {
    setFormData((prev) => {
      const updatedBuildings = (prev.buildings || []).map((b) => {
        if (b.id === bldId) {
          const configKey = zoneKey === 'cabin' ? 'cabinConfig' : 'lobbyConfig';
          const currentZone = b[configKey];
          const newZone = { ...currentZone, [field]: value };

          return {
            ...b,
            [configKey]: newZone,
          };
        }
        return b;
      });

      // If updating the active building & zone, sync root properties
      let updatedRoot = { ...prev, buildings: updatedBuildings };
      if (prev.selectedBuildingId === bldId && prev.selectedZone === zoneKey) {
        if (field === 'organizationText') updatedRoot.organizationText = value;
        if (field === 'marqueeText') updatedRoot.marqueeText = value;
        if (field === 'showMarquee') updatedRoot.showMarquee = value;
        if (field === 'displayOrientation') updatedRoot.displayOrientation = value;
        if (field === 'slideshowEnabled') updatedRoot.slideshowEnabled = value;
        if (field === 'autoScrollEnabled') updatedRoot.autoScrollEnabled = value;
        if (field === 'autoScrollSpeed') updatedRoot.autoScrollSpeed = value;
        if (field === 'slides') updatedRoot.slides = value;
      }

      return updatedRoot;
    });
  };

  // Add/Edit group modal state for BuildingManager
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [editingGroupForBuilding, setEditingGroupForBuilding] = useState<ScreenGroup | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<{ id: string; name: string } | null>(null);
  const [buildingToDelete, setBuildingToDelete] = useState<{ id: string; name: string } | null>(null);
  const [targetBuildingForGroup, setTargetBuildingForGroup] = useState<string>('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCode, setNewGroupCode] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  const handleOpenAddGroupForBuilding = (bldId: string) => {
    const bld = buildings.find((b) => b.id === bldId);
    setEditingGroupForBuilding(null);
    setTargetBuildingForGroup(bldId);
    setNewGroupName(`Nhóm Sảnh Thang Máy ${bld?.name || ''}`);
    setNewGroupCode(`GRP_${(bld?.code || 'NHOM').toUpperCase()}_SANH`);
    setNewGroupDesc(`Tất cả màn hình tại ${bld?.name || ''}`);
    setShowAddGroupModal(true);
  };

  const handleOpenEditGroupForBuilding = (grp: ScreenGroup) => {
    setEditingGroupForBuilding(grp);
    setTargetBuildingForGroup(grp.buildingId || '');
    setNewGroupName(grp.name);
    setNewGroupCode(grp.code);
    setNewGroupDesc(grp.description || '');
    setShowAddGroupModal(true);
  };

  const handleDeleteGroupForBuilding = (groupId: string, groupName: string) => {
    setGroupToDelete({ id: groupId, name: groupName });
  };

  const executeDeleteGroupForBuilding = async (groupId: string, groupName: string) => {
    try {
      await deleteGroupFirestore(groupId);
      fetch(`/api/screens/groups/${groupId}`, { method: 'DELETE' }).catch(() => {});
    } catch (e) {
      console.error('Error deleting group:', e);
    }

    setFormData((prev) => ({
      ...prev,
      screenGroups: (prev.screenGroups || []).filter((g) => g.id !== groupId),
    }));

    toast.success(`Đã xóa nhóm màn hình "${groupName}"!`);
  };

  const handleSaveGroupForBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingGroup) return;
    if (!newGroupName.trim() || !newGroupCode.trim() || !targetBuildingForGroup) return;

    setIsSavingGroup(true);
    const grpId = editingGroupForBuilding
      ? editingGroupForBuilding.id
      : `grp-${Date.now().toString().slice(-4)}`;

    const grp: ScreenGroup = {
      id: grpId,
      name: newGroupName.trim(),
      code: newGroupCode.trim().toUpperCase(),
      description: newGroupDesc.trim(),
      buildingId: targetBuildingForGroup,
    };

    // Non-blocking background sync
    upsertGroupFirestore(grp).catch(() => {});
    fetch('/api/screens/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(grp),
    }).catch(() => {});

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

    setShowAddGroupModal(false);
    setIsSavingGroup(false);
    setEditingGroupForBuilding(null);
    setNewGroupName('');
    setNewGroupCode('');
    setNewGroupDesc('');
    toast.success(
      editingGroupForBuilding
        ? `Đã cập nhật nhóm màn hình "${grp.name}"!`
        : `Đã thêm nhóm màn hình "${grp.name}" cho tòa nhà!`
    );
  };

  // Handle Add New Building
  const handleCreateBuilding = async () => {
    if (!newBldName.trim()) return;

    const newId = `building-${Date.now()}`;
    const codeClean = newBldCode.trim().toUpperCase() || `TOA_${buildings.length + 1}`;
    const newBld: BuildingItem = {
      id: newId,
      name: newBldName.trim(),
      code: codeClean,
      description: newBldDesc.trim() || 'Tòa nhà công sở mới',
      lobbyConfig: {
        zoneId: 'lobby',
        zoneName: 'Ngoài Sảnh Thang',
        displayOrientation: '16:9',
        organizationText: 'VĂN PHÒNG BỘ TÀI CHÍNH • SẢNH THANG MÁY',
        marqueeText: `Thông báo Tòa nhà: Chào mừng quý khách & cán bộ đến làm việc tại ${newBldName.trim()}.`,
        showMarquee: true,
        slideshowEnabled: true,
        autoScrollEnabled: true,
        autoScrollSpeed: 3,
        slides: JSON.parse(JSON.stringify(formData.slides || [])),
      },
      cabinConfig: {
        zoneId: 'cabin',
        zoneName: 'Trong Cabin Thang',
        displayOrientation: '9:16',
        organizationText: 'VĂN PHÒNG BỘ TÀI CHÍNH • CABIN THANG MÁY',
        marqueeText: `Thông báo Cabin: Vui lòng giữ gìn vệ sinh chung khi di chuyển bằng thang máy.`,
        showMarquee: true,
        slideshowEnabled: true,
        autoScrollEnabled: false,
        autoScrollSpeed: 3,
        slides: [],
      },
    };

    setFormData((prev) => ({
      ...prev,
      buildings: [...(prev.buildings || []), newBld],
    }));

    setNewBldName('');
    setNewBldCode('');
    setNewBldDesc('');
    setShowAddBuildingModal(false);
    setActiveBuildingEditTab(newId);
    toast.success(`Đã tạo Tòa nhà "${newBldName.trim()}"! Vui lòng tạo thủ công các nhóm màn hình phù hợp với tòa nhà.`);
  };

  // Delete Building
  const handleDeleteBuilding = (bldId: string) => {
    if (buildings.length <= 1) {
      toast.error('Hệ thống phải duy trì ít nhất 1 Tòa nhà!');
      return;
    }
    const bld = buildings.find((b) => b.id === bldId);
    if (bld) {
      setBuildingToDelete({ id: bldId, name: bld.name });
    }
  };

  const executeDeleteBuilding = (bldId: string) => {
    setFormData((prev) => {
      const filtered = (prev.buildings || []).filter((b) => b.id !== bldId);
      const nextActiveBld = filtered[0]?.id || 'building-a';
      return {
        ...prev,
        buildings: filtered,
        selectedBuildingId: prev.selectedBuildingId === bldId ? nextActiveBld : prev.selectedBuildingId,
      };
    });
    if (activeBuildingEditTab === bldId) {
      setActiveBuildingEditTab(buildings.find((b) => b.id !== bldId)?.id || '');
    }
    toast.success('Đã xóa Tòa nhà thành công!');
  };

  // Open copy modal
  const handleOpenCopyModal = (bldId: string, zone: LocationZone) => {
    setCopySource({ bldId, zone });
    setCopyTargetBldId(bldId);
    setCopyTargetZone(zone === 'cabin' ? 'lobby' : 'cabin');
    setShowCopyModal(true);
  };

  // Execute copy zone configuration
  const handleExecuteCopy = () => {
    if (!copySource) return;

    const sourceBld = buildings.find((b) => b.id === copySource.bldId);
    if (!sourceBld) return;

    const sourceConfig =
      copySource.zone === 'cabin' ? sourceBld.cabinConfig : sourceBld.lobbyConfig;

    setFormData((prev) => {
      const updatedBuildings = (prev.buildings || []).map((b) => {
        if (b.id === copyTargetBldId) {
          const configKey = copyTargetZone === 'cabin' ? 'cabinConfig' : 'lobbyConfig';
          const targetZoneName = copyTargetZone === 'cabin' ? 'Trong Cabin Thang' : 'Ngoài Sảnh Thang';

          return {
            ...b,
            [configKey]: {
              ...JSON.parse(JSON.stringify(sourceConfig)),
              zoneId: copyTargetZone,
              zoneName: targetZoneName,
            },
          };
        }
        return b;
      });

      return { ...prev, buildings: updatedBuildings };
    });

    setShowCopyModal(false);
    toast.success('Đã sao chép cấu hình thành công!');
  };

  const isModified =
    selectedBldId !== formData.selectedBuildingId ||
    selectedZoneType !== formData.selectedZone ||
    selectedGroupId !== (formData.selectedGroupId || '');

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* SECTION 1: Current Device Screen Binding & Zone Selector */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/30 p-6 rounded-3xl border border-cyan-500/20 shadow-xl space-y-5 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-600/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Màn Hình Này Đang Phát Thực Tế
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-cyan-500/40 text-cyan-300 font-mono font-bold text-xs tracking-wider shadow-sm">
                  Mã: {currentScreenId}
                </span>
                {appliedNotice && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full animate-bounce">
                    ✓ {appliedNotice}
                  </span>
                )}
              </div>
              <div className="text-xs font-semibold text-slate-300 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Tên thiết bị: <strong className="text-white font-bold">{currentScreenName}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Mã thiết bị: <strong className="text-cyan-400 font-mono font-bold">{currentScreenId}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Trụ sở: <strong className="text-white font-bold">{currentActiveBuilding?.name || 'Chưa chọn'}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Vị trí: <strong className="text-cyan-400 font-bold">{formData.selectedZone === 'cabin' ? 'Trong Cabin Thang (Màn dọc 9:16)' : 'Ngoài Sảnh Thang (Màn ngang 16:9)'}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleApplyToDevice}
              className="px-4.5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/10 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Áp Dụng Cho Màn Hình Này</span>
            </button>
            {isModified && (
              <span className="text-[10px] text-amber-400 font-extrabold animate-pulse">
                ⚠️ Có thay đổi lựa chọn chưa áp dụng!
              </span>
            )}
          </div>
        </div>

        {/* Trực quan hóa hướng dẫn cho người dùng - Compact layout */}
        <div className="flex items-start gap-2.5 p-3.5 bg-cyan-950/10 border border-cyan-800/20 rounded-2xl text-xs text-slate-300 leading-relaxed">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-cyan-300">Hướng dẫn cấu hình nhanh:</span> Chọn tòa nhà và nhóm màn hình phát bên dưới, sau đó bấm <span className="text-cyan-300 font-semibold">"Áp Dụng Cho Màn Hình Này"</span> ở trên để cập nhật thiết bị thực tế.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          {/* Select Building Dropdown */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-500" /> Chọn Tòa Nhà Muốn Thiết Lập
            </label>
            <select
              value={selectedBldId}
              onChange={(e) => setSelectedBldId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-bold text-xs rounded-xl px-3.5 py-3 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Select Screen Group Toggle */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-500" /> Chọn Nhóm Màn Hình Phát
            </label>
            
            {(() => {
              const buildingGroups = (formData.screenGroups || []).filter(
                (g) => g.buildingId === selectedBldId
              );
              
              if (buildingGroups.length > 0) {
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {buildingGroups.map((group) => {
                      const isSelected = selectedGroupId === group.id;
                      const isCabin = getZoneFromGroup(group) === 'cabin';
                      
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => handleGroupSelect(group)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer relative overflow-hidden ${
                            isSelected
                              ? 'bg-gradient-to-br from-cyan-950/85 via-cyan-900/20 to-cyan-950/85 border-cyan-500/40 text-white shadow-md'
                              : 'bg-slate-950 border-slate-900/80 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{isCabin ? '🛗' : '🏢'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-[11px] text-slate-200 truncate">{group.name}</p>
                              <p className="text-[9px] text-slate-400 tracking-wide mt-0.5 font-medium">
                                {isCabin ? 'Màn dọc Cabin (9:16)' : 'Màn ngang Sảnh (16:9)'}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              } else {
                return (
                  <div className="p-3 bg-slate-950/50 border border-slate-900 rounded-xl space-y-2">
                    <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1.5">
                      ⚠️ Chưa có nhóm màn hình nào trong tòa nhà này!
                    </p>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Vui lòng qua phân hệ cấu hình chi tiết tòa nhà bên dưới để tạo nhóm mới hoặc nhấp chọn tạm thời:
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGroupId('grp-lobby-fallback');
                          setSelectedZoneType('lobby');
                        }}
                        className={`p-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          selectedZoneType === 'lobby'
                            ? 'bg-cyan-950 border-cyan-800 text-cyan-300'
                            : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-white'
                        }`}
                      >
                        🏢 Sảnh (16:9)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGroupId('grp-cabin-fallback');
                          setSelectedZoneType('cabin');
                        }}
                        className={`p-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          selectedZoneType === 'cabin'
                            ? 'bg-cyan-950 border-cyan-800 text-cyan-300'
                            : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-white'
                        }`}
                      >
                        🛗 Cabin (9:16)
                      </button>
                    </div>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      </div>

      {/* SECTION 2: Buildings List & Content Configuration Matrix */}
      <div className="space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-900/60 flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold text-cyan-400 flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Quản Lý Tòa Nhà & Nội Dung Trình Chiếu
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Thiết lập liên kết trang web, khẩu hiệu chạy chữ, slide ảnh chi tiết cho từng cơ sở tòa nhà.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddBuildingModal(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs rounded-xl border border-slate-800 flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>Thêm Tòa Nhà Mới</span>
          </button>
        </div>

        {/* Buildings Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {buildings.map((bld) => {
            const isActive = activeBuildingEditTab === bld.id;
            const isAssigned = formData.selectedBuildingId === bld.id;

            return (
              <button
                key={bld.id}
                type="button"
                onClick={() => {
                  setActiveBuildingEditTab(bld.id);
                  setEditingBldId(null);
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 border-cyan-500/30 text-cyan-300 shadow-sm'
                    : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-cyan-500" />
                <span>{bld.name}</span>
                {isAssigned && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Màn hình hiện tại đang được cấu hình ở tòa nhà này" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Building Content Editor Panel */}
        {buildings.map((bld) => {
          if (bld.id !== activeBuildingEditTab) return null;

          const currentZoneKey = editingZoneMap[bld.id] || 'lobby';
          const currentZoneConfig =
            currentZoneKey === 'cabin' ? bld.cabinConfig : bld.lobbyConfig;
          const buildingGroups = (formData.screenGroups || []).filter(
            (g) => !g.buildingId || g.buildingId === bld.id || (formData.buildings?.length === 1)
          );

          return (
            <div
              key={bld.id}
              className="bg-slate-950/60 p-5 rounded-2xl border border-slate-900 space-y-6 animate-in fade-in duration-150"
            >
              {/* Building Info Header - Sleek Inline Row instead of 3 large block inputs */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-900/60">
                {editingBldId === bld.id ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 min-w-[280px]">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Tên Tòa Nhà</label>
                      <input
                        type="text"
                        value={bld.name}
                        onChange={(e) => handleUpdateBuildingInfo(bld.id, 'name', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 font-bold text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Mã Tòa Nhà</label>
                      <input
                        type="text"
                        value={bld.code}
                        onChange={(e) => handleUpdateBuildingInfo(bld.id, 'code', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 font-mono text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Ghi chú / Địa chỉ</label>
                      <input
                        type="text"
                        value={bld.description || ''}
                        onChange={(e) => handleUpdateBuildingInfo(bld.id, 'description', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-200">{bld.name}</h4>
                    {bld.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{bld.description}</p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingBldId(editingBldId === bld.id ? null : bld.id)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{editingBldId === bld.id ? 'Lưu Lại' : 'Sửa Tên Tòa Nhà'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBuilding(bld.id)}
                    className="p-1.5 bg-rose-950/20 hover:bg-rose-900/40 border border-rose-950/40 text-rose-300 rounded-xl transition-all cursor-pointer shrink-0"
                    title="Xóa Tòa nhà"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Screen Groups Block - Clean grid layout without nested dark cards */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-cyan-500" />
                      Nhóm Màn Hình Đang Quản Lý ({buildingGroups.length})
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Danh sách phân chia màn hình truyền hình/kiosk của cơ sở {bld.name}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenAddGroupForBuilding(bld.id)}
                    className="px-3.5 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Thêm Nhóm</span>
                  </button>
                </div>

                {buildingGroups.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-1">
                    Chưa có nhóm màn hình nào cho tòa nhà này. Hãy bấm "Thêm Nhóm" ở trên để khởi tạo.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {buildingGroups.map((grp) => {
                      const isCabin = grp.code?.toLowerCase().includes('cabin') || grp.name?.toLowerCase().includes('cabin');
                      return (
                        <div
                          key={grp.id}
                          className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-900 text-xs flex justify-between items-center gap-3 hover:border-slate-800 transition-all"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-200 truncate text-xs">{grp.name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                              {isCabin ? 'Màn dọc Cabin (9:16)' : 'Màn ngang Sảnh (16:9)'}
                            </div>
                            {grp.description && (
                              <div className="text-[10px] text-slate-500 mt-0.5 truncate">{grp.description}</div>
                            )}
                          </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditGroupForBuilding(grp)}
                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-850 text-cyan-400 border border-slate-900 transition-colors cursor-pointer"
                            title="Sửa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroupForBuilding(grp.id, grp.name)}
                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/20 text-rose-400 border border-slate-900 transition-colors cursor-pointer"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>

              {/* CONTENT SETUP WITH MODERN SEGMENTED CONTROLS AND DIVIDERS */}
              <div className="pt-6 border-t border-slate-900/60 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-cyan-500" />
                      Cấu Hình Nội Dung Theo Từng Hướng Màn Hình
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Thiết lập tiêu đề, thông báo chữ chạy, và slideshow theo chiều ngang (Sảnh) hoặc chiều dọc (Cabin).
                    </p>
                  </div>

                  {/* Sub-tabs for Cabin vs Lobby */}
                  <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingZoneMap((prev) => ({ ...prev, [bld.id]: 'lobby' }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        currentZoneKey === 'lobby'
                          ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/10'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>🏢 Màn ngang (Sảnh)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setEditingZoneMap((prev) => ({ ...prev, [bld.id]: 'cabin' }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        currentZoneKey === 'cabin'
                          ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/10'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>🛗 Màn dọc (Cabin)</span>
                    </button>
                  </div>
                </div>

                {/* Info status and copy config action */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/20 p-3 rounded-xl border border-slate-900 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="font-semibold text-cyan-300">
                      Đang chỉnh sửa: {currentZoneKey === 'cabin' ? 'Màn hình dọc Cabin (Tỉ lệ hiển thị 9:16)' : 'Màn hình ngang Sảnh (Tỉ lệ hiển thị 16:9)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenCopyModal(bld.id, currentZoneKey)}
                    className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 text-cyan-300 border border-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao Chép Bản Bản Trình Chiếu</span>
                  </button>
                </div>

                {/* Zone Configuration Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                  {/* Left Column: Tên tổ chức & Vòng lặp slide */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-cyan-500" /> Tên Tiêu Đề Tổ Chức / Banner
                      </label>
                      <input
                        type="text"
                        value={currentZoneConfig.organizationText || ''}
                        onChange={(e) =>
                          handleUpdateZone(bld.id, currentZoneKey, 'organizationText', e.target.value)
                        }
                        placeholder="Ví dụ: VĂN PHÒNG BỘ TÀI CHÍNH • SẢNH THANG MÁY..."
                        className="w-full bg-slate-900 border border-slate-850 text-slate-100 text-xs font-bold rounded-xl px-3.5 py-3 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-900/20 rounded-xl border border-slate-900">
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">
                          Trình Chiếu Slideshow ({currentZoneConfig.slides?.length || 0} slide)
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          Tự động chạy vòng lặp lịch họp và slide ảnh của hướng này.
                        </span>
                      </div>

                      <label className="flex items-center gap-2 text-xs font-bold text-cyan-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={currentZoneConfig.slideshowEnabled !== false}
                          onChange={(e) =>
                            handleUpdateZone(bld.id, currentZoneKey, 'slideshowEnabled', e.target.checked)
                          }
                          className="accent-cyan-500 rounded w-4 h-4 cursor-pointer"
                        />
                        <span>Kích Hoạt</span>
                      </label>
                    </div>
                  </div>

                  {/* Right Column: Dòng chữ chạy thông báo */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                          <Megaphone className="w-4 h-4 text-cyan-500" /> Dòng Chữ Chạy Thông Báo
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={currentZoneConfig.showMarquee !== false}
                            onChange={(e) =>
                              handleUpdateZone(bld.id, currentZoneKey, 'showMarquee', e.target.checked)
                            }
                            className="accent-cyan-500 rounded w-4 h-4 cursor-pointer"
                          />
                          <span>Bật chữ chạy</span>
                        </label>
                      </div>
                      <textarea
                        rows={3.5}
                        value={currentZoneConfig.marqueeText || ''}
                        onChange={(e) =>
                          handleUpdateZone(bld.id, currentZoneKey, 'marqueeText', e.target.value)
                        }
                        placeholder="Nội dung chữ chạy thông báo ở chân màn hình..."
                        className="w-full bg-slate-900 border border-slate-850 text-slate-100 text-xs rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: Add New Building */}
      {showAddBuildingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" /> Thêm Tòa Nhà Mới
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Tên Tòa Nhà (*)</label>
                <input
                  type="text"
                  value={newBldName}
                  onChange={(e) => setNewBldName(e.target.value)}
                  placeholder="Ví dụ: Tòa Nhà B - Khối Cơ Quan Mở Rộng"
                  className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-sm font-bold rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Mã Tòa Nhà</label>
                <input
                  type="text"
                  value={newBldCode}
                  onChange={(e) => setNewBldCode(e.target.value)}
                  placeholder="TOA_B"
                  className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-sm font-mono rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Ghi Chú / Mô Tả</label>
                <input
                  type="text"
                  value={newBldDesc}
                  onChange={(e) => setNewBldDesc(e.target.value)}
                  placeholder="Khu vực làm việc các Cục, Vụ..."
                  className="w-full bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddBuildingModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleCreateBuilding}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
              >
                Tạo Tòa Nhà
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Copy Configuration */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Copy className="w-5 h-5 text-cyan-400" /> Sao Chép Cấu Hình Nội Dung
            </h3>

            <p className="text-xs text-slate-400">
              Sao chép toàn bộ Danh sách Slide (Trang Web & Ảnh), Banner tổ chức và Chữ chạy thông báo từ vị trí hiện tại sang vị trí mục tiêu.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Tòa Nhà Mục Tiêu</label>
                <select
                  value={copyTargetBldId}
                  onChange={(e) => setCopyTargetBldId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-xs font-bold rounded-2xl p-3 focus:outline-none"
                >
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Vị Trí Màn Hình Mục Tiêu</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCopyTargetZone('lobby')}
                    className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                      copyTargetZone === 'lobby'
                        ? 'bg-cyan-600 border-cyan-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    🏢 Ngoài Sảnh Thang
                  </button>

                  <button
                    type="button"
                    onClick={() => setCopyTargetZone('cabin')}
                    className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                      copyTargetZone === 'cabin'
                        ? 'bg-cyan-600 border-cyan-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    🛗 Trong Cabin Thang
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleExecuteCopy}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer"
              >
                Thực Hiện Sao Chép
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÊM / SỬA NHÓM CHO TÒA NHÀ */}
      {showAddGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                {editingGroupForBuilding ? 'Chỉnh Sửa Nhóm Màn Hình' : 'Thêm Nhóm Màn Hình Cho Tòa Nhà'}
              </h4>
              <button onClick={() => setShowAddGroupModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGroupForBuilding} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tòa nhà sở thuộc:</label>
                <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 text-xs font-bold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  {buildings.find((b) => b.id === targetBuildingForGroup)?.name || 'Tòa nhà'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tên nhóm màn hình:</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
                  placeholder="e.g. Sảnh Thang Máy Tầng 1"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mã nhóm (định danh):</label>
                <input
                  type="text"
                  required
                  value={newGroupCode}
                  onChange={(e) => setNewGroupCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 text-xs outline-none focus:border-cyan-400 font-mono uppercase"
                  placeholder="e.g. GRP_SANH_T1"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mô tả vị trí:</label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-cyan-400"
                  placeholder="e.g. Nhóm màn hình sảnh thang máy"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSavingGroup}
                  onClick={() => setShowAddGroupModal(false)}
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
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>{editingGroupForBuilding ? 'Cập Nhật' : 'Lưu Nhóm'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Screen Group */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-full bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Xác nhận xóa nhóm</h3>
                <p className="text-[11px] text-slate-400">Các màn hình thuộc nhóm này sẽ cần được cấu hình lại</p>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Bạn có chắc chắn muốn xóa nhóm màn hình <strong className="text-cyan-400">"{groupToDelete.name}"</strong>? Thao tác này không thể hoàn tác.
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
                  const item = groupToDelete;
                  setGroupToDelete(null);
                  await executeDeleteGroupForBuilding(item.id, item.name);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-rose-600/20"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Building */}
      {buildingToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-full bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Xác nhận xóa tòa nhà</h3>
                <p className="text-[11px] text-slate-400">Toàn bộ cấu hình hiển thị của tòa nhà sẽ bị xóa sạch</p>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Bạn có chắc chắn muốn xóa Tòa nhà <strong className="text-rose-400">"{buildingToDelete.name}"</strong>? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBuildingToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  const item = buildingToDelete;
                  setBuildingToDelete(null);
                  executeDeleteBuilding(item.id);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-rose-600/20"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
