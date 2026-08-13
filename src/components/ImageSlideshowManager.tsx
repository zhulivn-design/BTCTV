import React, { useState, useEffect } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Globe,
  Image as ImageIcon,
  Clock,
  Sparkles,
  Check,
  Eye,
  Sliders,
  Play,
  Layers,
  FileImage,
  ArrowRight,
  Info,
  Filter,
  CheckSquare,
  Square,
  X,
  Edit2,
  CheckCircle2,
  Smartphone,
  ZoomIn,
  Link,
  Loader2
} from 'lucide-react';
import { SlideItem, TransitionEffect, SlideType, ScreenGroup } from '../types';
import { fetchFirestoreState } from '../lib/firebaseStore';

const DEFAULT_SCREEN_GROUPS: ScreenGroup[] = [];

interface ImageSlideshowManagerProps {
  slides: SlideItem[];
  onChangeSlides: (updatedSlides: SlideItem[]) => void;
  defaultWebDuration: number;
  defaultImageDuration: number;
  groups?: ScreenGroup[];
  currentUser?: { email: string; role: 'admin' | 'operator'; name: string } | null;
}

export const ImageSlideshowManager: React.FC<ImageSlideshowManagerProps> = ({
  slides,
  onChangeSlides,
  defaultWebDuration,
  defaultImageDuration,
  groups: propGroups,
  currentUser,
}) => {
  // Screen groups state
  const [groups, setGroups] = useState<ScreenGroup[]>(
    propGroups && propGroups.length > 0 ? propGroups : DEFAULT_SCREEN_GROUPS
  );

  // Sync propGroups whenever parent updates them
  useEffect(() => {
    if (propGroups && propGroups.length > 0) {
      setGroups(propGroups);
    }
  }, [propGroups]);

  // Fetch groups from server or Firestore if available
  useEffect(() => {
    let synced = false;
    fetch('/api/screens/state')
      .then((res) => {
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
          return res.json();
        }
        return null;
      })
      .then((data) => {
        if (data && data.ok && data.groups) {
          setGroups(data.groups);
          synced = true;
        }
        if (!synced) {
          fetchFirestoreState().then((fsState) => {
            if (fsState && fsState.groups) {
              setGroups(fsState.groups);
            }
          }).catch(() => {});
        }
      })
      .catch(() => {
        fetchFirestoreState().then((fsState) => {
          if (fsState && fsState.groups) {
            setGroups(fsState.groups);
          }
        }).catch(() => {});
      });
  }, []);

  // Filter state for playlist view
  const [selectedFilterGroup, setSelectedFilterGroup] = useState<string>('ALL');

  // Form Inputs for New Slide Creation
  const [targetScopeInput, setTargetScopeInput] = useState<'all' | 'groups'>('all');
  const [selectedGroupIdsInput, setSelectedGroupIdsInput] = useState<string[]>([]);

  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageTitleInput, setImageTitleInput] = useState('');
  const [imageCaptionInput, setImageCaptionInput] = useState('');
  const [imageDurationInput, setImageDurationInput] = useState(10);
  const [imageTransitionInput, setImageTransitionInput] = useState<TransitionEffect>('fade');
  const [pendingUploadedImage, setPendingUploadedImage] = useState<{
    url: string;
    name: string;
    mediaId?: string;
  } | null>(null);

  const [webUrlInput, setWebUrlInput] = useState('');
  const [webTitleInput, setWebTitleInput] = useState('');
  const [webDurationInput, setWebDurationInput] = useState(20);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'web' | 'playlist'>('playlist');

  // Modal / Drawer state to edit slide group assignment inline
  const [editingSlideTargetId, setEditingSlideTargetId] = useState<string | null>(null);
  const editingSlideTarget = slides.find((s) => s.id === editingSlideTargetId);

  // Edit slide modal state
  const [editingSlideModal, setEditingSlideModal] = useState<SlideItem | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [editCaptionInput, setEditCaptionInput] = useState('');
  const [editDurationInput, setEditDurationInput] = useState(10);
  const [editTransitionInput, setEditTransitionInput] = useState<TransitionEffect>('fade');
  const [editTargetScopeInput, setEditTargetScopeInput] = useState<'all' | 'groups'>('all');
  const [editGroupIdsInput, setEditGroupIdsInput] = useState<string[]>([]);
  const [editUrlInput, setEditUrlInput] = useState('');
  const [isSavingSlide, setIsSavingSlide] = useState(false);

  const handleOpenEditSlide = (slide: SlideItem) => {
    setEditingSlideModal(slide);
    setEditTitleInput(slide.title || '');
    setEditCaptionInput(slide.caption || '');
    setEditDurationInput(slide.durationSeconds || 10);
    setEditTransitionInput(slide.transition || 'fade');
    setEditTargetScopeInput(slide.targetScope || 'all');
    const validGroupIds = (slide.targetGroupIds || []).filter(id => groups.some(g => g.id === id));
    setEditGroupIdsInput(validGroupIds.length > 0 ? validGroupIds : groups.map(g => g.id));
    setEditUrlInput(slide.url || '');
  };

  const handleSaveEditedSlide = () => {
    if (isSavingSlide || !editingSlideModal) return;
    setIsSavingSlide(true);
    try {
      const finalGroupIds = editTargetScopeInput === 'groups'
        ? (editGroupIdsInput.length > 0 ? editGroupIdsInput.filter(id => groups.some(g => g.id === id)) : groups.map(g => g.id))
        : [];
      const updated = slides.map((s) => {
        if (s.id === editingSlideModal.id) {
          return {
            ...s,
            title: editTitleInput.trim() || s.title,
            caption: editCaptionInput.trim(),
            durationSeconds: editDurationInput || 10,
            transition: editTransitionInput,
            targetScope: editTargetScopeInput,
            targetGroupIds: finalGroupIds,
            url: editUrlInput.trim() || s.url,
          };
        }
        return s;
      });
      onChangeSlides(updated);
      setEditingSlideModal(null);
    } finally {
      setIsSavingSlide(false);
    }
  };

  // Helper function to compress image client-side
  const compressImage = (file: File, maxSizeBytes: number = 1.5 * 1024 * 1024): Promise<{ dataUrl: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      if (file.type === 'image/gif' && file.size <= maxSizeBytes) {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ dataUrl: e.target?.result as string, mimeType: file.type });
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
        return;
      }

      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const maxDimension = 2560;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Không thể khởi tạo Canvas 2D'));
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.92;
        let outputMime = file.type === 'image/png' ? 'image/jpeg' : file.type;
        if (!['image/jpeg', 'image/webp'].includes(outputMime)) {
          outputMime = 'image/jpeg';
        }

        let dataUrl = canvas.toDataURL(outputMime, quality);

        while (dataUrl.length * 0.75 > maxSizeBytes && quality > 0.2) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL(outputMime, quality);

          if (quality <= 0.3 && dataUrl.length * 0.75 > maxSizeBytes) {
            width = Math.round(width * 0.8);
            height = Math.round(height * 0.8);
            canvas.width = width;
            canvas.height = height;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            quality = 0.8;
            dataUrl = canvas.toDataURL(outputMime, quality);
          }
        }

        resolve({ dataUrl, mimeType: outputMime });
      };

      img.onerror = () => reject(new Error('Không thể đọc tập tin hình ảnh'));
      reader.readAsDataURL(file);
    });
  };

  // Handle local File Upload
  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Vui lòng chọn tệp hình ảnh (PNG, JPG, WEBP, GIF)');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const compressed = await compressImage(file, 1.5 * 1024 * 1024);
      const base64Data = compressed.dataUrl;

      let finalUrl = base64Data;
      let mediaId: string | undefined = undefined;

      try {
        const resp = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            data: base64Data,
            mimeType: compressed.mimeType,
          }),
        });

        const contentType = resp.headers.get('content-type');
        if (resp.ok && contentType && contentType.includes('application/json')) {
          const resData = await resp.json();
          if (resData.ok) {
            finalUrl = resData.url || base64Data;
            mediaId = resData.id;
          }
        }
      } catch (e) {
        // Static hosting fallback uses base64Data directly
      }

      setPendingUploadedImage({
        url: finalUrl,
        name: file.name.replace(/\.[^/.]+$/, ''),
        mediaId,
      });
      setImageTitleInput(file.name.replace(/\.[^/.]+$/, ''));
      setImageCaptionInput('');
      setIsUploading(false);
    } catch (err: any) {
      setUploadError('Lỗi khi nén và tải ảnh lên: ' + err.message);
      setIsUploading(false);
    }
  };

  // Confirm adding the pending uploaded image to slide list
  const handleConfirmAddSlide = () => {
    if (!pendingUploadedImage) return;

    const newSlide: SlideItem & { mediaId?: string } = {
      id: 'slide-img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      type: 'image',
      title: imageTitleInput.trim() || pendingUploadedImage.name,
      url: pendingUploadedImage.url,
      durationSeconds: imageDurationInput || defaultImageDuration || 10,
      transition: imageTransitionInput,
      enabled: true,
      caption: imageCaptionInput.trim() || 'Thông báo & tuyên truyền mới',
      fitMode: 'cover',
      targetScope: targetScopeInput,
      targetGroupIds: targetScopeInput === 'groups' ? (selectedGroupIdsInput.length > 0 ? selectedGroupIdsInput : groups.map(g => g.id)) : [],
      ...(pendingUploadedImage.mediaId ? { mediaId: pendingUploadedImage.mediaId } : {}),
    };

    onChangeSlides([...slides, newSlide]);
    setPendingUploadedImage(null);
    setImageTitleInput('');
    setImageCaptionInput('');
    setActiveTab('playlist');
  };

  // Discard pending uploaded image
  const handleCancelPendingImage = () => {
    setPendingUploadedImage(null);
    setImageTitleInput('');
    setImageCaptionInput('');
  };

  // Add Image via Web URL
  const handleAddImageByUrl = () => {
    if (!imageUrlInput.trim()) return;

    let cleanUrl = imageUrlInput.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('data:')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const newSlide: SlideItem = {
      id: 'slide-img-' + Date.now(),
      type: 'image',
      title: imageTitleInput || 'Hình ảnh quảng cáo',
      url: cleanUrl,
      durationSeconds: imageDurationInput || defaultImageDuration || 10,
      transition: imageTransitionInput,
      enabled: true,
      caption: imageCaptionInput,
      fitMode: 'cover',
      targetScope: targetScopeInput,
      targetGroupIds: targetScopeInput === 'groups' ? (selectedGroupIdsInput.length > 0 ? selectedGroupIdsInput : groups.map(g => g.id)) : [],
    };

    onChangeSlides([...slides, newSlide]);
    setImageUrlInput('');
    setImageTitleInput('');
    setImageCaptionInput('');
    setActiveTab('playlist');
  };

  // Add Web Page Slide
  const handleAddWebSlide = () => {
    if (!webUrlInput.trim()) return;

    let cleanUrl = webUrlInput.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const newSlide: SlideItem = {
      id: 'slide-web-' + Date.now(),
      type: 'web',
      title: webTitleInput || 'Trang web thang máy',
      url: cleanUrl,
      durationSeconds: webDurationInput || defaultWebDuration || 20,
      transition: 'fade',
      enabled: true,
      fitMode: 'cover',
      targetScope: targetScopeInput,
      targetGroupIds: targetScopeInput === 'groups' ? (selectedGroupIdsInput.length > 0 ? selectedGroupIdsInput : groups.map(g => g.id)) : [],
    };

    onChangeSlides([...slides, newSlide]);
    setWebUrlInput('');
    setWebTitleInput('');
    setActiveTab('playlist');
  };

  // Reorder & Modify
  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;

    const updated = [...slides];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    onChangeSlides(updated);
  };

  const handleToggleSlide = (id: string) => {
    const updated = slides.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    onChangeSlides(updated);
  };

  const handleDeleteSlide = (id: string) => {
    const targetSlide = slides.find((s) => s.id === id) as (SlideItem & { mediaId?: string }) | undefined;
    if (targetSlide?.mediaId) {
      fetch(`/api/upload/${targetSlide.mediaId}`, { method: 'DELETE' }).catch(() => {});
    }
    const updated = slides.filter((s) => s.id !== id);
    onChangeSlides(updated);
  };

  const handleUpdateSlideField = (id: string, field: keyof SlideItem, value: any) => {
    const updated = slides.map((s) => (s.id === id ? { ...s, [field]: value } : s));
    onChangeSlides(updated);
  };

  const handleUpdateSlideFields = (id: string, fields: Partial<SlideItem>) => {
    const updated = slides.map((s) => (s.id === id ? { ...s, ...fields } : s));
    onChangeSlides(updated);
  };

  // Filter slides according to selected group
  const filteredSlides = slides.filter((slide) => {
    if (selectedFilterGroup === 'ALL') return true;
    if (selectedFilterGroup === 'GLOBAL') {
      return slide.targetScope !== 'groups' || !slide.targetGroupIds || slide.targetGroupIds.length === 0;
    }
    // Specific Group ID selected
    if (slide.targetScope !== 'groups' || !slide.targetGroupIds || slide.targetGroupIds.length === 0) {
      return true; // Global slides also apply to all groups
    }
    return slide.targetGroupIds.includes(selectedFilterGroup);
  });

  const globalSlidesCount = slides.filter(
    (s) => s.targetScope !== 'groups' || !s.targetGroupIds || s.targetGroupIds.length === 0
  ).length;

  // Render Target Group Badge on Card
  const renderGroupBadge = (slide: SlideItem) => {
    if (slide.targetScope !== 'groups' || !slide.targetGroupIds || slide.targetGroupIds.length === 0) {
      return (
        <span className="px-2 py-0.5 rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-800 text-[10px] font-bold inline-flex items-center gap-1">
          <Globe className="w-3 h-3 text-cyan-400" /> Slide Dùng Chung (Tất cả nhóm)
        </span>
      );
    }

    const assignedNames = slide.targetGroupIds
      .map((gid) => groups.find((g) => g.id === gid)?.name || gid)
      .join(', ');

    return (
      <span
        className="px-2 py-0.5 rounded-lg bg-indigo-950/80 text-indigo-300 border border-indigo-800 text-[10px] font-bold inline-flex items-center gap-1"
        title={assignedNames}
      >
        <Layers className="w-3 h-3 text-indigo-400" /> Nhóm: {assignedNames}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Main Sub Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/60 rounded-2xl p-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('playlist')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'playlist'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" /> Danh Sách Slide Thông Báo ({slides.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'upload'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-4 h-4" /> Tải Ảnh Thông Báo Lên
        </button>
        {currentUser?.role === 'admin' && (
          <button
            type="button"
            onClick={() => setActiveTab('web')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'web'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" /> Thêm Trang Web / Bảng Tin
          </button>
        )}
      </div>

      {/* PLAYLIST LIST TAB */}
      {activeTab === 'playlist' && (
        <div className="space-y-4">
          {/* GROUP FILTER BAR */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-bold flex items-center gap-1.5 text-cyan-300">
                <Filter className="w-3.5 h-3.5" /> Lọc Slide Theo Nhóm Màn Hình Hiển Thị:
              </span>
              <span className="text-slate-400">
                Hiển thị <strong className="text-cyan-400">{filteredSlides.length}</strong>/{slides.length} slide
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedFilterGroup('ALL')}
                className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedFilterGroup === 'ALL'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Globe className="w-3.5 h-3.5" /> Tất Cả Slide ({slides.length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedFilterGroup('GLOBAL')}
                className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedFilterGroup === 'GLOBAL'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                🌐 Slide Dùng Chung Tất Cả Nhóm ({globalSlidesCount} slide)
              </button>

              {groups.map((grp) => {
                const count = slides.filter(
                  (s) => s.targetScope !== 'groups' || s.targetGroupIds?.includes(grp.id)
                ).length;

                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setSelectedFilterGroup(grp.id)}
                    className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      selectedFilterGroup === grp.id
                        ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-cyan-300" /> {grp.name} ({count} slide)
                  </button>
                );
              })}
            </div>
          </div>

          {filteredSlides.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/50 border border-dashed border-slate-800 rounded-3xl space-y-3">
              <FileImage className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">
                Không tìm thấy slide thông báo nào cho bộ lọc đã chọn!
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Hiện tại có {slides.length} slide nhưng không slide nào thuộc bộ lọc này. Bấm nút dưới để hiển thị lại toàn bộ slide.
              </p>
              <button
                type="button"
                onClick={() => setSelectedFilterGroup('ALL')}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer inline-flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" /> Hiển Thị Tất Cả ({slides.length}) Slide
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSlides.map((slide, idx) => (
                <div
                  key={slide.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row gap-4 items-start md:items-center justify-between ${
                    slide.enabled
                      ? 'bg-slate-950/80 border-slate-800 text-slate-100'
                      : 'bg-slate-950/30 border-slate-900/60 text-slate-500 opacity-60'
                  }`}
                >
                  {/* Thumbnail & Title */}
                  <div className="flex items-center gap-3 min-w-0 w-full md:flex-1">
                    <input
                      type="checkbox"
                      checked={slide.enabled}
                      disabled={currentUser?.role !== 'admin' && slide.type === 'web'}
                      onChange={() => handleToggleSlide(slide.id)}
                      className={`w-5 h-5 accent-cyan-500 rounded shrink-0 ${
                        currentUser?.role !== 'admin' && slide.type === 'web' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                      }`}
                      title={currentUser?.role !== 'admin' && slide.type === 'web' ? 'Chỉ quản trị viên mới được bật/tắt trang web/lịch họp' : 'Bật / Tắt slide'}
                    />

                    {slide.type === 'image' ? (
                      <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 relative">
                        <img
                          src={slide.url}
                          alt={slide.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-cyan-900 to-blue-900 border border-cyan-800 flex items-center justify-center shrink-0">
                        <Globe className="w-6 h-6 text-cyan-300" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-extrabold text-cyan-400">
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          value={slide.title}
                          disabled={currentUser?.role !== 'admin' && slide.type === 'web'}
                          onChange={(e) =>
                            handleUpdateSlideField(slide.id, 'title', e.target.value)
                          }
                          className={`font-bold text-sm text-slate-100 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-cyan-400 focus:outline-none truncate w-full ${
                            currentUser?.role !== 'admin' && slide.type === 'web' ? 'cursor-not-allowed text-slate-400' : ''
                          }`}
                          placeholder="Tiêu đề slide..."
                        />
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        {/* Target Badge with Edit Click */}
                        <div
                          onClick={() => {
                            if (!(currentUser?.role !== 'admin' && slide.type === 'web')) {
                              setEditingSlideTargetId(slide.id);
                            }
                          }}
                          className={`${
                            currentUser?.role !== 'admin' && slide.type === 'web'
                              ? 'cursor-not-allowed opacity-80'
                              : 'cursor-pointer hover:opacity-80 transition-opacity'
                          }`}
                          title={currentUser?.role !== 'admin' && slide.type === 'web' ? 'Yêu cầu tài khoản cao cấp hơn để đổi nhóm cho lịch họp' : 'Bấm để chỉnh sửa nhóm màn hình hiển thị slide này'}
                        >
                          {renderGroupBadge(slide)}
                        </div>

                        {slide.type === 'web' && (
                          <div className="w-full mt-2">
                            <input
                              type="text"
                              value={slide.url}
                              disabled={currentUser?.role !== 'admin'}
                              onChange={(e) =>
                                handleUpdateSlideField(slide.id, 'url', e.target.value)
                              }
                              className={`font-mono text-xs text-slate-200 bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-cyan-400 focus:outline-none rounded-lg px-2 py-1 w-full ${
                                currentUser?.role !== 'admin' ? 'cursor-not-allowed opacity-50' : ''
                              }`}
                              placeholder="Nhập địa chỉ URL..."
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Settings Controls */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0 pt-3 md:pt-0 min-w-fit">
                    <button
                      type="button"
                      onClick={() => handleOpenEditSlide(slide)}
                      className="px-2 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs text-amber-300 border border-slate-800 flex items-center gap-1 cursor-pointer shrink-0"
                      title="Sửa thông tin slide"
                    >
                      <Edit2 className="w-3 h-3" /> Sửa
                    </button>

                    {/* Duration input */}
                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <input
                        type="number"
                        min={2}
                        max={600}
                        value={slide.durationSeconds}
                        disabled={currentUser?.role !== 'admin' && slide.type === 'web'}
                        onChange={(e) =>
                          handleUpdateSlideField(
                            slide.id,
                            'durationSeconds',
                            Number(e.target.value)
                          )
                        }
                        className={`w-12 text-center font-mono font-bold bg-transparent text-cyan-300 focus:outline-none ${
                          currentUser?.role !== 'admin' && slide.type === 'web' ? 'cursor-not-allowed opacity-50' : ''
                        }`}
                      />
                      <span className="text-slate-400 font-semibold">giây</span>
                    </div>

                    {/* Portrait Mode (For Web) */}
                    {slide.type === 'web' && (
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
                        <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                        <label className={`flex items-center gap-2 cursor-pointer ${currentUser?.role !== 'admin' ? 'cursor-not-allowed opacity-50' : ''}`}>
                          <input
                            type="checkbox"
                            checked={!!slide.isPortraitMode}
                            disabled={currentUser?.role !== 'admin'}
                            onChange={(e) => handleUpdateSlideField(slide.id, 'isPortraitMode', e.target.checked)}
                            className="w-3.5 h-3.5 accent-cyan-500 rounded"
                          />
                          <span className="text-slate-200 font-semibold truncate" title="Đánh dấu trang này hiển thị trên màn dọc">Chế độ dọc</span>
                        </label>
                      </div>
                    )}

                    {/* Custom Zoom (For Web) */}
                    {slide.type === 'web' && (
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
                        <ZoomIn className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-slate-200 font-semibold truncate">Zoom:</span>
                        <input
                          type="number"
                          min={10}
                          max={500}
                          value={slide.customZoom || ''}
                          placeholder="Mặc định"
                          disabled={currentUser?.role !== 'admin'}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleUpdateSlideField(
                              slide.id,
                              'customZoom',
                              val ? Number(val) : undefined
                            );
                          }}
                          className={`w-14 text-center font-mono font-bold bg-transparent text-cyan-300 focus:outline-none placeholder:text-slate-600 ${
                            currentUser?.role !== 'admin' ? 'cursor-not-allowed opacity-50' : ''
                          }`}
                        />
                        <span className="text-slate-400 font-semibold">%</span>
                      </div>
                    )}

                    {/* Transition Selector */}
                    {slide.type === 'image' && (
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <select
                          value={slide.transition}
                          onChange={(e) =>
                            handleUpdateSlideField(
                              slide.id,
                              'transition',
                              e.target.value as TransitionEffect
                            )
                          }
                          className="bg-transparent text-slate-200 font-semibold focus:outline-none text-xs cursor-pointer"
                        >
                          <option value="fade" className="bg-slate-900">Mờ dần (Fade)</option>
                          <option value="slide-left" className="bg-slate-900">Trượt trái</option>
                          <option value="slide-right" className="bg-slate-900">Trượt phải</option>
                          <option value="slide-up" className="bg-slate-900">Trượt lên</option>
                          <option value="zoom-in" className="bg-slate-900">Phóng to (Zoom)</option>
                          <option value="flip" className="bg-slate-900">Lật trang (Flip)</option>
                          <option value="blur" className="bg-slate-900">Mờ nhòe (Blur)</option>
                        </select>
                      </div>
                    )}

                    {/* Move Up/Down/Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0 || (currentUser?.role !== 'admin' && slide.type === 'web')}
                        onClick={() => handleMoveSlide(idx, 'up')}
                        className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 rounded-lg border border-slate-800 cursor-pointer"
                        title="Di chuyển lên"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === slides.length - 1 || (currentUser?.role !== 'admin' && slide.type === 'web')}
                        onClick={() => handleMoveSlide(idx, 'down')}
                        className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 rounded-lg border border-slate-800 cursor-pointer"
                        title="Di chuyển xuống"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>

                      {!(currentUser?.role !== 'admin' && slide.type === 'web') ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteSlide(slide.id)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg border border-rose-500/20 transition-colors cursor-pointer"
                          title="Xóa slide"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="p-1.5 bg-slate-950 text-slate-600 rounded-lg border border-slate-900 cursor-not-allowed opacity-50"
                          title="Chỉ quản trị viên mới được xóa trang web lịch họp"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* UPLOAD IMAGE TAB */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* GROUP TARGET SELECTION SELECTOR */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <label className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              1. Chọn Nhóm Màn Hình Sẽ Hiển Thị Slide Ảnh Này:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div
                onClick={() => {
                  setTargetScopeInput('all');
                  setSelectedGroupIdsInput([]);
                }}
                className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                  targetScopeInput === 'all'
                    ? 'bg-cyan-950/60 border-cyan-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${targetScopeInput === 'all' ? 'border-cyan-400 bg-cyan-500' : 'border-slate-600'}`}>
                  {targetScopeInput === 'all' && <Check className="w-3 h-3 text-slate-950 font-bold" />}
                </div>
                <div>
                  <div className="font-bold text-slate-100">🌐 Tất Cả Nhóm Màn Hình (Toàn hệ thống)</div>
                  <div className="text-[10px] text-slate-400">Tất cả màn hình đều sẽ chiếu slide này</div>
                </div>
              </div>

              <div
                onClick={() => {
                  setTargetScopeInput('groups');
                  if (selectedGroupIdsInput.length === 0 && groups.length > 0) {
                    setSelectedGroupIdsInput(groups.map((g) => g.id));
                  }
                }}
                className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                  targetScopeInput === 'groups'
                    ? 'bg-indigo-950/60 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${targetScopeInput === 'groups' ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'}`}>
                  {targetScopeInput === 'groups' && <Check className="w-3 h-3 text-white font-bold" />}
                </div>
                <div>
                  <div className="font-bold text-slate-100">🏢 Chỉ Phát Cho Nhóm Chỉ Định</div>
                  <div className="text-[10px] text-slate-400">Chọn 1 hoặc nhiều nhóm màn hình bên dưới</div>
                </div>
              </div>
            </div>

            {targetScopeInput === 'groups' && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 pt-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 pb-1 border-b border-slate-800">
                  <span>Tích chọn các nhóm màn hình nhận slide:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const allGroupIds = groups.map((g) => g.id);
                      const isAllSelected = allGroupIds.length > 0 && allGroupIds.every((gid) => selectedGroupIdsInput.includes(gid));
                      setSelectedGroupIdsInput(isAllSelected ? [] : allGroupIds);
                    }}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    {groups.length > 0 && groups.every((g) => selectedGroupIdsInput.includes(g.id)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả các nhóm'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groups.map((grp) => {
                    const isChecked = selectedGroupIdsInput.includes(grp.id);
                    return (
                      <div
                        key={grp.id}
                        onClick={() => {
                          if (isChecked) setSelectedGroupIdsInput(selectedGroupIdsInput.filter((id) => id !== grp.id));
                          else setSelectedGroupIdsInput([...selectedGroupIdsInput, grp.id]);
                        }}
                        className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center gap-2 text-xs ${
                          isChecked ? 'bg-indigo-950/80 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {isChecked ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                        <span className="font-medium">{grp.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Drag and drop upload zone or Details Form */}
          {pendingUploadedImage ? (
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  2. Đã tải ảnh lên thành công. Cấu hình chi tiết Slide:
                </h3>
                <button
                  type="button"
                  onClick={handleCancelPendingImage}
                  className="text-slate-400 hover:text-rose-400 transition-all text-xs flex items-center gap-1 font-bold cursor-pointer"
                >
                  <X className="w-4 h-4" /> Hủy bỏ / Chọn ảnh khác
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Thumbnail column */}
                <div className="flex flex-col items-center justify-center p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <img
                    src={pendingUploadedImage.url}
                    alt="Pending Slide"
                    className="max-h-40 max-w-full rounded-lg object-contain bg-slate-900 border border-slate-800 shadow-inner"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-[10px] text-slate-400 truncate max-w-full font-mono text-center">{pendingUploadedImage.name}</div>
                </div>

                {/* Inputs column */}
                <div className="md:col-span-2 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block font-semibold">Tiêu Đề Slide Thông Báo <span className="text-rose-400">*</span></label>
                      <input
                        type="text"
                        value={imageTitleInput}
                        onChange={(e) => setImageTitleInput(e.target.value)}
                        placeholder="Tên hoặc tiêu đề của slide"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 mb-1 block font-semibold">Hiệu Ứng Chuyển Cảnh</label>
                      <select
                        value={imageTransitionInput}
                        onChange={(e) => setImageTransitionInput(e.target.value as TransitionEffect)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      >
                        <option value="fade">Mờ dần (Fade)</option>
                        <option value="slide-left">Trượt từ phải sang trái</option>
                        <option value="slide-right">Trượt từ trái sang phải</option>
                        <option value="slide-up">Trượt từ dưới lên</option>
                        <option value="zoom-in">Phóng to (Zoom-in)</option>
                        <option value="flip">Lật thẻ 3D (Flip)</option>
                        <option value="blur">Mờ nhòe (Blur)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 mb-1 block font-semibold">
                        Thời Gian Hiển Thị (Giây) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={600}
                        value={imageDurationInput}
                        onChange={(e) => setImageDurationInput(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 mb-1 block font-semibold">Nội Dung Chi Tiết / Mô Tả Slide</label>
                      <input
                        type="text"
                        value={imageCaptionInput}
                        onChange={(e) => setImageCaptionInput(e.target.value)}
                        placeholder="Nhập nội dung/chú thích mô tả..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmAddSlide}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Xác Nhận Thêm Slide Thông Báo Vào Danh Sách
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer ${
                dragOver
                  ? 'border-cyan-400 bg-cyan-950/30'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-950/40'
              }`}
            >
              <input
                type="file"
                accept="image/*"
                id="file-upload-input"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <label htmlFor="file-upload-input" className="cursor-pointer space-y-3 block">
                <div className="w-16 h-16 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-2xl flex items-center justify-center mx-auto">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-bold text-slate-100">
                    Kéo thả tệp ảnh vào đây, hoặc <span className="text-cyan-400 underline">Bấm để chọn tệp</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Hỗ trợ PNG, JPG, WEBP, GIF (Tự động nén tối ưu dưới 1.5 MB/ảnh)
                  </p>
                </div>
              </label>
              {isUploading && (
                <p className="text-xs text-cyan-400 font-bold animate-pulse mt-2">
                  Đang xử lý & tải ảnh lên...
                </p>
              )}
              {uploadError && <p className="text-xs text-rose-400 font-bold mt-2">{uploadError}</p>}
            </div>
          )}

          {/* OR Add image via URL */}
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Hoặc Thêm Đường Dẫn Ảnh Web (URL)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">URL Hình Ảnh</label>
                <input
                  type="text"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://example.com/quang-cao.jpg"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tiêu Đề Thông Báo / Tuyên Truyền</label>
                <input
                  type="text"
                  value={imageTitleInput}
                  onChange={(e) => setImageTitleInput(e.target.value)}
                  placeholder="Ví dụ: Thông Báo Lịch Họp Ban Giám Đốc"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Thời Gian Hiển Thị (Giây)
                </label>
                <input
                  type="number"
                  min={2}
                  max={600}
                  value={imageDurationInput}
                  onChange={(e) => setImageDurationInput(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Hiệu Ứng Chuyển Cảnh</label>
                <select
                  value={imageTransitionInput}
                  onChange={(e) => setImageTransitionInput(e.target.value as TransitionEffect)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <option value="fade">Mờ dần (Fade)</option>
                  <option value="slide-left">Trượt từ phải sang trái</option>
                  <option value="slide-right">Trượt từ trái sang phải</option>
                  <option value="slide-up">Trượt từ dưới lên</option>
                  <option value="zoom-in">Phóng to (Zoom-in)</option>
                  <option value="flip">Lật thẻ 3D (Flip)</option>
                  <option value="blur">Mờ nhòe (Blur)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Nội Dung Chi Tiết / Mô Tả Thông Báo</label>
                <input
                  type="text"
                  value={imageCaptionInput}
                  onChange={(e) => setImageCaptionInput(e.target.value)}
                  placeholder="Ví dụ: Họp lúc 9h00 ngày 15/08 tại Phòng Họp Lớn. Trân trọng kính mời..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddImageByUrl}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Thêm Ảnh Thông Báo Vào Danh Sách
            </button>
          </div>
        </div>
      )}

      {/* ADD WEB SLIDE TAB */}
      {activeTab === 'web' && (
        <div className="space-y-6">
          {/* GROUP TARGET SELECTOR FOR WEB SLIDE */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <label className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Chọn Nhóm Màn Hình Hiển Thị Trang Web Này:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div
                onClick={() => {
                  setTargetScopeInput('all');
                  setSelectedGroupIdsInput([]);
                }}
                className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                  targetScopeInput === 'all'
                    ? 'bg-cyan-950/60 border-cyan-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${targetScopeInput === 'all' ? 'border-cyan-400 bg-cyan-500' : 'border-slate-600'}`}>
                  {targetScopeInput === 'all' && <Check className="w-3 h-3 text-slate-950 font-bold" />}
                </div>
                <div>
                  <div className="font-bold text-slate-100">🌐 Tất Cả Nhóm Màn Hình</div>
                  <div className="text-[10px] text-slate-400">Hiển thị trên toàn bộ các màn hình</div>
                </div>
              </div>

              <div
                onClick={() => {
                  setTargetScopeInput('groups');
                  if (selectedGroupIdsInput.length === 0 && groups.length > 0) {
                    setSelectedGroupIdsInput(groups.map((g) => g.id));
                  }
                }}
                className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                  targetScopeInput === 'groups'
                    ? 'bg-indigo-950/60 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${targetScopeInput === 'groups' ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'}`}>
                  {targetScopeInput === 'groups' && <Check className="w-3 h-3 text-white font-bold" />}
                </div>
                <div>
                  <div className="font-bold text-slate-100">🏢 Nhóm Cụ Thể</div>
                  <div className="text-[10px] text-slate-400">Chỉ mở trang web trên nhóm được chọn</div>
                </div>
              </div>
            </div>

            {targetScopeInput === 'groups' && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 pt-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 pb-1 border-b border-slate-800">
                  <span>Chọn nhóm nhận trang web:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const allGroupIds = groups.map((g) => g.id);
                      const isAllSelected = allGroupIds.length > 0 && allGroupIds.every((gid) => selectedGroupIdsInput.includes(gid));
                      setSelectedGroupIdsInput(isAllSelected ? [] : allGroupIds);
                    }}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    {groups.length > 0 && groups.every((g) => selectedGroupIdsInput.includes(g.id)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả các nhóm'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {groups.map((grp) => {
                    const isChecked = selectedGroupIdsInput.includes(grp.id);
                    return (
                      <div
                        key={grp.id}
                        onClick={() => {
                          if (isChecked) setSelectedGroupIdsInput(selectedGroupIdsInput.filter((id) => id !== grp.id));
                          else setSelectedGroupIdsInput([...selectedGroupIdsInput, grp.id]);
                        }}
                        className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center gap-2 ${
                          isChecked ? 'bg-indigo-950/80 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {isChecked ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                        <span className="font-medium">{grp.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" /> Thêm Trang Web Mới Vào Vòng Lặp Slideshow
            </h4>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-400">Đường Dẫn Trang Web (URL)</label>
                  <button
                    type="button"
                    onClick={() => {
                      setWebUrlInput('https://vbdhbtc.mof.gov.vn/calendar.html');
                      if (!webTitleInput) {
                        setWebTitleInput('Lịch Công Tác Bộ Tài Chính');
                      }
                    }}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    <Link className="w-3 h-3 text-amber-400" />
                    <span>Chèn URL Lịch Công Tác BTC</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={webUrlInput}
                  onChange={(e) => setWebUrlInput(e.target.value)}
                  placeholder="https://vbdhbtc.mof.gov.vn/calendar.html hoặc https://vnexpress.net"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Tên Trang Web</label>
                  <input
                    type="text"
                    value={webTitleInput}
                    onChange={(e) => setWebTitleInput(e.target.value)}
                    placeholder="Ví dụ: VnExpress Tin Tức"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Thời Gian Mở Trang (Giây)</label>
                  <input
                    type="number"
                    min={5}
                    max={1200}
                    value={webDurationInput}
                    onChange={(e) => setWebDurationInput(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddWebSlide}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Thêm Trang Web Vào Vòng Lặp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITING SLIDE TARGET GROUP INLINE */}
      {editingSlideTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Đổi Nhóm Màn Hình Cho Slide
              </h4>
              <button onClick={() => setEditingSlideTargetId(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <div className="font-bold text-cyan-300">{editingSlideTarget.title}</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{editingSlideTarget.url}</div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">Chọn phạm vi hiển thị:</label>

                <div
                  onClick={() => {
                    handleUpdateSlideFields(editingSlideTarget.id, {
                      targetScope: 'all',
                      targetGroupIds: [],
                    });
                  }}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition-all ${
                    editingSlideTarget.targetScope !== 'groups'
                      ? 'bg-cyan-950/80 border-cyan-500 text-white shadow-md ring-1 ring-cyan-500/50'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold flex items-center gap-2">
                    🌐 Tất Cả Nhóm Màn Hình (Toàn Hệ Thống)
                  </span>
                  {editingSlideTarget.targetScope !== 'groups' && (
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                </div>

                <div
                  onClick={() => {
                    const currentGroupIds = editingSlideTarget.targetGroupIds || [];
                    const defaultIds = currentGroupIds.length > 0 ? currentGroupIds : groups.map((g) => g.id);
                    handleUpdateSlideFields(editingSlideTarget.id, {
                      targetScope: 'groups',
                      targetGroupIds: defaultIds,
                    });
                  }}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition-all ${
                    editingSlideTarget.targetScope === 'groups'
                      ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/50'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold flex items-center gap-2">
                    🏢 Chỉ Nhóm Được Chọn
                  </span>
                  {editingSlideTarget.targetScope === 'groups' && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  )}
                </div>

                {editingSlideTarget.targetScope === 'groups' && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentIds = editingSlideTarget.targetGroupIds || [];
                          const allGroupIds = groups.map((g) => g.id);
                          const isAllSelected = allGroupIds.length > 0 && allGroupIds.every((gid) => currentIds.includes(gid));
                          handleUpdateSlideFields(editingSlideTarget.id, {
                            targetScope: 'groups',
                            targetGroupIds: isAllSelected ? [] : allGroupIds,
                          });
                        }}
                        className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        {groups.length > 0 && groups.every((g) => (editingSlideTarget.targetGroupIds || []).includes(g.id))
                          ? 'Bỏ chọn tất cả'
                          : 'Chọn tất cả các nhóm màn hình'}
                      </button>
                      <span className="text-[10px] text-slate-400">
                        Đã chọn {(editingSlideTarget.targetGroupIds || []).length}/{groups.length} nhóm
                      </span>
                    </div>

                    {groups.map((grp) => {
                      const currentIds = editingSlideTarget.targetGroupIds || [];
                      const isChecked = currentIds.includes(grp.id);

                      return (
                        <div
                          key={grp.id}
                          onClick={() => {
                            const newIds = isChecked
                              ? currentIds.filter((id) => id !== grp.id)
                              : [...currentIds, grp.id];
                            handleUpdateSlideFields(editingSlideTarget.id, {
                              targetScope: 'groups',
                              targetGroupIds: newIds,
                            });
                          }}
                          className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center gap-2 text-xs ${
                            isChecked ? 'bg-indigo-950 border-indigo-500 text-white font-semibold' : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          {isChecked ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                          <span>{grp.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setEditingSlideTargetId(null)}
                className="px-5 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs cursor-pointer hover:bg-cyan-400"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SLIDE MODAL */}
      {editingSlideModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                Chỉnh Sửa Thông Tin Slide ({editingSlideModal.type === 'image' ? 'Ảnh' : 'Trang Web'})
              </h3>
              <button
                type="button"
                onClick={() => setEditingSlideModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 mb-1 block font-semibold">Tiêu Đề Slide <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  value={editTitleInput}
                  onChange={(e) => setEditTitleInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              {editingSlideModal.type === 'image' ? (
                <div>
                  <label className="text-slate-400 mb-1 block font-semibold">Nội Dung / Chú Thích (Caption hiển thị trên màn hình)</label>
                  <input
                    type="text"
                    value={editCaptionInput}
                    onChange={(e) => setEditCaptionInput(e.target.value)}
                    placeholder="Nhập nội dung chú thích hiển thị ở khung chữ..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-slate-400 mb-1 block font-semibold">Đường Dẫn URL Trang Web</label>
                  <input
                    type="text"
                    value={editUrlInput}
                    onChange={(e) => setEditUrlInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 mb-1 block font-semibold">Thời Gian (Giây)</label>
                  <input
                    type="number"
                    min={2}
                    max={600}
                    value={editDurationInput}
                    onChange={(e) => setEditDurationInput(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>

                {editingSlideModal.type === 'image' && (
                  <div>
                    <label className="text-slate-400 mb-1 block font-semibold">Hiệu Ứng Chuyển Cảnh</label>
                    <select
                      value={editTransitionInput}
                      onChange={(e) => setEditTransitionInput(e.target.value as TransitionEffect)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    >
                      <option value="fade">Mờ dần (Fade)</option>
                      <option value="slide-left">Trượt trái</option>
                      <option value="slide-right">Trượt phải</option>
                      <option value="slide-up">Trượt lên</option>
                      <option value="zoom-in">Phóng to (Zoom-in)</option>
                      <option value="flip">Lật thẻ (Flip)</option>
                      <option value="blur">Mờ nhòe (Blur)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Target Scope selection */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-slate-400 font-semibold block">Nhóm Màn Hình Áp Dụng Slide Này:</label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setEditTargetScopeInput('all')}
                    className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 ${
                      editTargetScopeInput === 'all' ? 'bg-cyan-950 border-cyan-500 text-white font-semibold' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${editTargetScopeInput === 'all' ? 'border-cyan-400 bg-cyan-500' : 'border-slate-600'}`} />
                    <span>Tất cả nhóm</span>
                  </div>
                  <div
                    onClick={() => {
                      setEditTargetScopeInput('groups');
                      if (editGroupIdsInput.length === 0 && groups.length > 0) {
                        setEditGroupIdsInput(groups.map((g) => g.id));
                      }
                    }}
                    className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 ${
                      editTargetScopeInput === 'groups' ? 'bg-indigo-950 border-indigo-500 text-white font-semibold' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${editTargetScopeInput === 'groups' ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'}`} />
                    <span>Nhóm chỉ định</span>
                  </div>
                </div>

                {editTargetScopeInput === 'groups' && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 pb-1 border-b border-slate-800">
                      <span>Chọn nhóm:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = groups.map((g) => g.id);
                          const isAll = allIds.length > 0 && allIds.every((id) => editGroupIdsInput.includes(id));
                          setEditGroupIdsInput(isAll ? [] : allIds);
                        }}
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        {groups.length > 0 && groups.every((g) => editGroupIdsInput.includes(g.id)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {groups.map((grp) => {
                        const isChecked = editGroupIdsInput.includes(grp.id);
                        return (
                          <div
                            key={grp.id}
                            onClick={() => {
                              if (isChecked) setEditGroupIdsInput(editGroupIdsInput.filter((id) => id !== grp.id));
                              else setEditGroupIdsInput([...editGroupIdsInput, grp.id]);
                            }}
                            className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 text-xs ${
                              isChecked ? 'bg-indigo-950 border-indigo-500 text-white font-semibold' : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}
                          >
                            {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-indigo-400" /> : <Square className="w-3.5 h-3.5 text-slate-600" />}
                            <span className="truncate">{grp.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isSavingSlide}
                onClick={() => setEditingSlideModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSavingSlide}
                onClick={handleSaveEditedSlide}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
              >
                {isSavingSlide ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang Lưu...</span>
                  </>
                ) : (
                  <span>Lưu Thay Đổi</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
