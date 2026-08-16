export type ProxyMode = 'direct' | 'proxy';

export type UserAgentMode = 'android_tv' | 'desktop_chrome' | 'mobile_safari';

export type TransitionEffect =
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'zoom-in'
  | 'flip'
  | 'blur';

export type SlideType = 'web' | 'image';

export interface SlideItem {
  id: string;
  type: SlideType;
  title: string;
  url: string; // Web URL or Image URL (or base64)
  durationSeconds: number; // Duration to show this slide (seconds)
  transition: TransitionEffect;
  enabled: boolean;
  caption?: string;
  category?: string;
  fitMode?: 'contain' | 'cover' | 'fill';
  targetScope?: 'all' | 'groups'; // 'all' (Tất cả nhóm) hoặc 'groups' (Theo nhóm chọn)
  targetGroupIds?: string[]; // Danh sách ID nhóm màn hình áp dụng (e.g. ['grp-1', 'grp-2'])
  isPortraitMode?: boolean; // Tùy chọn màn hình dọc cho web slide
  customZoom?: number; // Mức thu phóng riêng biệt cho URL này
}

export type DisplayOrientation = '16:9' | '9:16' | '4:3';

export type LocationZone = 'cabin' | 'lobby';

export interface ZoneConfig {
  zoneId: LocationZone; // 'cabin' (Trong Cabin Thang) | 'lobby' (Ngoài Sảnh Thang)
  zoneName: string; // e.g. "Trong Cabin Thang" | "Ngoài Sảnh Thang"
  displayOrientation: DisplayOrientation; // '16:9' or '9:16'
  organizationText: string; // Tiêu đề cơ quan/tòa nhà
  marqueeText: string; // Dòng chữ chạy thông báo riêng cho nhóm này
  showMarquee: boolean;
  slideshowEnabled: boolean;
  autoScrollEnabled: boolean;
  autoScrollSpeed: number;
  slides: SlideItem[];
}

export interface BuildingItem {
  id: string;
  name: string; // e.g., "Tòa nhà A - Trụ sở chính"
  code: string; // e.g., "TOA_A"
  address?: string;
  description?: string;
  cabinConfig: ZoneConfig; // Cấu hình màn hình hiển thị trong Cabin thang
  lobbyConfig: ZoneConfig; // Cấu hình màn hình hiển thị ngoài Sảnh thang
}

export interface TVConfig {
  proxyMode: ProxyMode;
  zoomLevel: number; // e.g., 100 for 100%, 125, 150
  autoReloadMinutes: number; // 0 = off, 1, 5, 15, 30, 60
  autoScrollEnabled: boolean; // Auto scroll down if content extends below
  autoScrollSpeed: number; // 1 (Slow) to 10 (Fast), e.g., 3 = Medium
  isFullscreen: boolean;
  showTvBezel: boolean;
  pinCode: string; // 4-digit code for settings lock
  kioskLock: boolean; // Hide menu/OSD unless PIN entered
  autoStartOnBoot: boolean; // Auto-start on system boot
  sleepMode: {
    enabled: boolean;
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
  };
  osdTimeoutSeconds: number; // 3, 5, 10
  userAgent: UserAgentMode;
  lastUpdated: string;
  themeColor: string;

  // Building & Zone Location Management
  selectedBuildingId: string; // Active assigned building ID
  selectedZone: LocationZone; // Active assigned zone: 'cabin' or 'lobby'
  selectedGroupId?: string; // Active assigned screen group ID
  buildings: BuildingItem[]; // List of buildings with their cabin & lobby zone configs
  screenGroups?: ScreenGroup[]; // Temporary for storing groups

  // Signage Information Board & Slideshow settings
  slideshowEnabled: boolean;
  defaultWebDurationSeconds: number; // Default duration for web items (e.g. 30s)
  defaultImageDurationSeconds: number; // Default duration for image items (e.g. 10s)
  globalTransition: TransitionEffect;
  displayOrientation: DisplayOrientation; // '16:9' (Màn ngang) vs '9:16' (Màn dọc) vs '4:3'
  showHeader: boolean; // Hiển thị thanh tiêu đề trên (Logo, Tên đơn vị, Giờ, Thời tiết)
  showLogo: boolean; // Hiển thị Logo thương hiệu/đơn vị
  logoUrl: string; // URL hoặc ảnh base64 Logo đơn vị
  organizationText: string; // Ví dụ "BAN QUẢN LÝ TÒA NHÀ • BẢNG THÔNG BÁO NỘI BỘ"
  showSlideCaption: boolean; // Bật / Tắt khung tiêu đề & mô tả dưới hình ảnh thông báo
  showMarquee: boolean; // Bật chữ chạy thông báo / tin tức
  marqueeText: string; // Nội dung chữ chạy
  marqueeSpeed: number; // 1-5 (Chậm - Nhanh)
  slides: SlideItem[]; // Danh sách các slide (Trang web lịch họp & Ảnh thông báo)
}

export interface ScreenGroup {
  id: string;
  name: string; // e.g. "Nhóm Sảnh Thang Máy Tòa A", "Nhóm Cabin Tòa B"
  code: string; // e.g. "GRP_SANH_A"
  description?: string;
  buildingId?: string;
  zone?: LocationZone;
  orientation?: DisplayOrientation;
}

export interface ScreenDevice {
  id: string; // Device ID e.g. "SCR_LOBBY_01"
  name: string; // e.g. "Màn hình Sảnh Thang 1 - Tòa A"
  groupId: string; // Group ID
  groupName?: string;
  buildingId: string;
  zone: LocationZone;
  status: 'online' | 'offline';
  lastSeen: number; // Timestamp ms
  ipAddress?: string;
  resolution?: string; // e.g. "1920x1080 (16:9)"
  orientation?: DisplayOrientation; // '16:9' | '9:16' | '4:3'
  currentConfigVersion?: string;
  assignedConfig?: Partial<ZoneConfig>;
  approved?: boolean;
  requestedAt?: number;
  lastPublishedAt?: number;
}

export type PublishTargetType = 'all' | 'groups' | 'screens' | 'single';

export interface PublishPayload {
  targetType: PublishTargetType;
  targetGroupIds: string[];
  targetScreenIds: string[];
  title?: string;
  updatedBy?: string;
  publishedAt?: string;
  config: Partial<ZoneConfig>;
}

export interface PublishHistoryItem {
  id: string;
  publishedAt?: string;
  timestamp?: string;
  title?: string;
  targetSummary?: string;
  targetType: PublishTargetType;
  targetGroupNames?: string[];
  affectedScreensCount?: number;
  affectedScreenCount?: number;
  configSnapshot?: Partial<ZoneConfig>;
  config?: Partial<ZoneConfig>;
  publisherEmail?: string;
  publisherName?: string;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  category: 'dashboard' | 'signage' | 'media' | 'utility' | 'news';
  iconName?: string;
  description?: string;
  previewImage?: string;
}

export type DPadDirection =
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'SELECT'
  | 'BACK'
  | 'MENU'
  | 'REFRESH'
  | 'FULLSCREEN'
  | 'PLAY_PAUSE';

