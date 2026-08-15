import express from "express";
import "dotenv/config";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { LRUCache } from 'lru-cache';
import { createServer as createViteServer } from "vite";
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();
console.log("Firebase Admin initialized successfully.");

let isFirestoreQuotaExhausted = false;

interface FirestoreDailyUsage {
  date: string; // YYYY-MM-DD
  reads: number;
  writes: number;
  deletes: number;
}

interface FirestoreApiLog {
  id: string;
  timestamp: string;
  operation: 'read' | 'write' | 'delete';
  collection: string;
  docId?: string;
  status: 'success' | 'quota_exhausted' | 'error';
  message?: string;
  count: number;
}

const DAILY_USAGE_FILE = path.join(process.cwd(), "firestore_daily_usage.json");
const API_LOGS_FILE = path.join(process.cwd(), "firestore_api_logs.json");

let firestoreDailyUsage: Record<string, FirestoreDailyUsage> = {};
let firestoreApiLogs: FirestoreApiLog[] = [];

function loadFirestoreUsageStores() {
  try {
    if (fs.existsSync(DAILY_USAGE_FILE)) {
      firestoreDailyUsage = JSON.parse(fs.readFileSync(DAILY_USAGE_FILE, 'utf8'));
    }
  } catch {
    firestoreDailyUsage = {};
  }

  try {
    if (fs.existsSync(API_LOGS_FILE)) {
      firestoreApiLogs = JSON.parse(fs.readFileSync(API_LOGS_FILE, 'utf8'));
    }
  } catch {
    firestoreApiLogs = [];
  }
}

function saveFirestoreUsageStores() {
  if (process.env.VERCEL) return;
  try {
    fs.writeFileSync(DAILY_USAGE_FILE, JSON.stringify(firestoreDailyUsage, null, 2), 'utf8');
    fs.writeFileSync(API_LOGS_FILE, JSON.stringify(firestoreApiLogs.slice(0, 200), null, 2), 'utf8');
  } catch (err) {
    console.error("Error saving firestore usage logs:", err);
  }
}

loadFirestoreUsageStores();

function recordFirestoreUsage(
  operation: 'read' | 'write' | 'delete',
  collectionName: string,
  docId?: string,
  status: 'success' | 'quota_exhausted' | 'error' = 'success',
  message?: string,
  count: number = 1
) {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (!firestoreDailyUsage[todayStr]) {
    firestoreDailyUsage[todayStr] = {
      date: todayStr,
      reads: 0,
      writes: 0,
      deletes: 0,
    };
  }

  if (status === 'success') {
    if (operation === 'read') firestoreDailyUsage[todayStr].reads += count;
    else if (operation === 'write') firestoreDailyUsage[todayStr].writes += count;
    else if (operation === 'delete') firestoreDailyUsage[todayStr].deletes += count;
  }

  const newLog: FirestoreApiLog = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toISOString(),
    operation,
    collection: collectionName,
    docId,
    status,
    message,
    count,
  };

  firestoreApiLogs.unshift(newLog);
  if (firestoreApiLogs.length > 200) {
    firestoreApiLogs.pop();
  }

  saveFirestoreUsageStores();
}

function handleFirestoreError(err: any, actionName: string, operation: 'read' | 'write' | 'delete' = 'read', collectionName: string = 'system') {
  console.error(`[Firestore Error - ${actionName} - ${collectionName}]:`, err);
  if (
    err?.code === 'resource-exhausted' ||
    err?.code === 8 ||
    err?.status === 8 ||
    err?.message?.includes('RESOURCE_EXHAUSTED') ||
    err?.message?.includes('Quota limit exceeded')
  ) {
    recordFirestoreUsage(operation, collectionName, actionName, 'quota_exhausted', err.message || 'Quota exceeded');
    if (!isFirestoreQuotaExhausted) {
      isFirestoreQuotaExhausted = true;
      console.warn(`[Firestore Quota] Daily limit reached (${actionName}). Automatically switching to local RAM / JSON storage for this session.`);
    }
  } else {
    recordFirestoreUsage(operation, collectionName, actionName, 'error', err?.message || String(err));
  }
}

// Online status cache: Stores deviceId -> timestamp
const onlineDevicesCache = new LRUCache<string, number>({
  max: 10000,
  ttl: 65000, // 65 seconds
});

function sanitizeForFirestore(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => (value === undefined ? null : value)));
}

async function loadScreensFromFirestore() {
  if (isFirestoreQuotaExhausted) return;
  try {
    const snap = await db.collection('screens').get();
    recordFirestoreUsage('read', 'screens', undefined, 'success', undefined, Math.max(1, snap.size));
    if (!snap.empty) {
      const fsScreens: ScreenDeviceData[] = [];
      snap.forEach((d) => {
        fsScreens.push({ id: d.id, ...d.data() } as ScreenDeviceData);
      });

      for (const scr of fsScreens) {
        if (!scr.id) continue;
        const cleanFsId = scr.id.trim().toUpperCase();
        const idx = screenDevicesStore.findIndex((s) => (s.id || '').trim().toLowerCase() === cleanFsId.toLowerCase());
        if (idx >= 0) {
          // If approved in EITHER memory OR firestore, preserve approval = true
          const isApproved = (screenDevicesStore[idx].approved === true) || (scr.approved === true);
          screenDevicesStore[idx] = {
            ...screenDevicesStore[idx],
            ...scr,
            id: cleanFsId,
            approved: isApproved,
            lastSeen: Math.max(scr.lastSeen || 0, screenDevicesStore[idx].lastSeen || 0),
          };
        } else {
          screenDevicesStore.push({
            ...scr,
            id: cleanFsId,
            approved: scr.approved === true,
          });
        }
      }
      saveScreens();
    }
  } catch (err: any) {
    handleFirestoreError(err, 'loadScreensFromFirestore', 'read', 'screens');
  }
}

async function syncScreenToFirestore(screen: ScreenDeviceData) {
  if (isFirestoreQuotaExhausted) return;
  try {
    await db.collection('screens').doc(screen.id).set(sanitizeForFirestore(screen), { merge: true });
    recordFirestoreUsage('write', 'screens', screen.id);
  } catch (err: any) {
    handleFirestoreError(err, 'syncScreenToFirestore', 'write', 'screens');
  }
}

async function removeScreenFromFirestore(screenId: string) {
  if (isFirestoreQuotaExhausted) return;
  try {
    await db.collection('screens').doc(screenId).delete();
    recordFirestoreUsage('delete', 'screens', screenId);
  } catch (err: any) {
    handleFirestoreError(err, 'removeScreenFromFirestore', 'delete', 'screens');
  }
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// User Account persistence database
interface UserAccount {
  email: string;
  password?: string;
  role: 'admin' | 'operator';
  name: string;
}

// Password Hashing Helper (SHA-256)
function hashSha256Server(text: string): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return crypto.createHash("sha256").update(trimmed).digest("hex");
}

function normalizePasswordHash(pwd: string): string {
  if (!pwd) return "";
  const trimmed = pwd.trim();
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return hashSha256Server(trimmed);
}

const USERS_FILE = path.join(process.cwd(), "users.json");

let usersStore: UserAccount[] = [];

async function syncUserToFirestore(user: UserAccount) {
  if (isFirestoreQuotaExhausted) return;
  console.log(`[DEBUG - syncUserToFirestore]: Syncing user ${user.email}...`);
  try {
    const docId = user.email.toLowerCase().trim();
    const pwdHash = normalizePasswordHash(user.password);
    await db.collection('users').doc(docId).set({
      email: docId,
      password: pwdHash,
      passwordHash: pwdHash,
      role: user.role,
      name: user.name,
      updatedAt: Date.now()
    }, { merge: true });
    recordFirestoreUsage('write', 'users', docId);
    console.log(`[DEBUG - syncUserToFirestore]: Successfully synced user ${user.email}.`);
  } catch (err: any) {
    handleFirestoreError(err, 'syncUserToFirestore', 'write', 'users');
  }
}

async function loadUsersFromFirestore() {
  if (isFirestoreQuotaExhausted) return;
  console.log("Starting loadUsersFromFirestore...");
  try {
    const snap = await db.collection('users').get();
    console.log(`loadUsersFromFirestore: Found ${snap.size} docs.`);
    recordFirestoreUsage('read', 'users', undefined, 'success', undefined, Math.max(1, snap.size));
    if (!snap.empty) {
      const fsUsers: UserAccount[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const rawPwd = data.passwordHash || data.password || '';
        fsUsers.push({
          email: d.id,
          password: normalizePasswordHash(rawPwd),
          role: data.role || 'operator',
          name: data.name || d.id
        });
      });
      if (fsUsers.length > 0) {
        usersStore = fsUsers;
        saveUsers();
        console.log("loadUsersFromFirestore: Updated usersStore.");
      }
    } else {
      console.log("loadUsersFromFirestore: No users found, seeding.");
      // Seed default accounts into Firestore
      for (const u of usersStore) {
        await syncUserToFirestore(u).catch((e) => console.error("Seed error:", e));
      }
    }
  } catch (err: any) {
    handleFirestoreError(err, 'loadUsersFromFirestore', 'read', 'users');
  }
}

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        usersStore = parsed.map((u: any) => ({
          ...u,
          password: normalizePasswordHash(u.password || '')
        }));
      }
    } else {
      saveUsers();
    }
  } catch (err) {
    console.error("Error loading users database:", err);
  }
}

function saveUsers() {
  if (process.env.VERCEL) return;
  try {
    const hashedStore = usersStore.map(u => ({
      ...u,
      password: normalizePasswordHash(u.password || '')
    }));
    fs.writeFileSync(USERS_FILE, JSON.stringify(hashedStore, null, 2), 'utf8');
  } catch (err) {
    console.error("Error saving users database:", err);
  }
}

// Initial load
loadUsers();

// In-store for uploaded media items with durable file and Firestore persistence
const uploadedMedia = new Map<string, { id: string; name: string; url: string; data: string; mimeType: string }>();
const MEDIA_FILE = path.join(process.cwd(), "media.json");

function loadMedia() {
  try {
    if (fs.existsSync(MEDIA_FILE)) {
      const data = fs.readFileSync(MEDIA_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && item.id) {
            uploadedMedia.set(item.id, item);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error loading media database:", err);
  }
}

function saveMedia() {
  if (process.env.VERCEL) return;
  try {
    const list = Array.from(uploadedMedia.values());
    fs.writeFileSync(MEDIA_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error("Error saving media database:", err);
  }
}

async function syncMediaToFirestore(mediaObj: any) {
  if (isFirestoreQuotaExhausted) return;
  try {
    await db.collection('media').doc(mediaObj.id).set(sanitizeForFirestore(mediaObj), { merge: true });
    recordFirestoreUsage('write', 'media', mediaObj.id);
  } catch (err: any) {
    handleFirestoreError(err, 'syncMediaToFirestore', 'write', 'media');
  }
}

async function deleteMediaFromFirestore(mediaId: string) {
  if (isFirestoreQuotaExhausted) return;
  try {
    await db.collection('media').doc(mediaId).delete();
    recordFirestoreUsage('delete', 'media', mediaId);
  } catch (err: any) {
    handleFirestoreError(err, 'deleteMediaFromFirestore', 'delete', 'media');
  }
}

async function loadMediaFromFirestore() {
  if (isFirestoreQuotaExhausted) return;
  try {
    const snap = await db.collection('media').get();
    recordFirestoreUsage('read', 'media', undefined, 'success', undefined, Math.max(1, snap.size));
    if (!snap.empty) {
      snap.forEach((d) => {
        const data = d.data();
        if (data && data.id) {
          uploadedMedia.set(data.id, data as any);
        }
      });
      saveMedia();
    }
  } catch (err: any) {
    handleFirestoreError(err, 'loadMediaFromFirestore', 'read', 'media');
  }
}

loadMedia();

// In-memory store for screen groups, screens, and published configs per screen/group
interface ScreenGroupData {
  id: string;
  name: string;
  code: string;
  description?: string;
  buildingId?: string;
}

interface ScreenDeviceData {
  id: string;
  name: string;
  groupId: string;
  buildingId: string;
  zone: 'cabin' | 'lobby';
  status: 'online' | 'offline';
  lastSeen: number;
  ipAddress?: string;
  resolution?: string;
  assignedConfig?: any;
  approved?: boolean;
  requestedAt?: number;
}

const SCREENS_FILE = path.join(process.cwd(), "screens.json");

interface PublishHistoryRecord {
  id: string;
  publishedAt: string;
  targetSummary: string;
  targetType: string;
  affectedScreensCount: number;
  configSnapshot: any;
  publisherEmail?: string;
  publisherName?: string;
}

const GROUPS_FILE = path.join(process.cwd(), "groups.json");
let screenGroupsStore: ScreenGroupData[] = [];

function loadGroups() {
  try {
    if (fs.existsSync(GROUPS_FILE)) {
      const data = fs.readFileSync(GROUPS_FILE, 'utf8');
      screenGroupsStore = JSON.parse(data);
    } else {
      saveGroups();
    }
  } catch (err) {
    console.error("Error loading groups database:", err);
  }
}

function saveGroups() {
  if (process.env.VERCEL) return;
  try {
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(screenGroupsStore, null, 2), 'utf8');
  } catch (err) {
    console.error("Error saving groups database:", err);
  }
}

loadGroups();

async function syncGlobalConfigToFirestore(config: any) {
  if (isFirestoreQuotaExhausted || !config) return;
  console.log(`[DEBUG - syncGlobalConfigToFirestore]: Syncing global config...`);
  try {
    const generalConfig = { ...config, buildings: [], slides: [] };
    const buildingsConfig = { buildings: config.buildings || [] };
    const slidesConfig = { slides: config.slides || [] };

    await Promise.all([
      setDoc(doc(db, 'settings', 'tv_config_general'), sanitizeForFirestore(generalConfig)),
      setDoc(doc(db, 'settings', 'tv_config_buildings'), sanitizeForFirestore(buildingsConfig)),
      setDoc(doc(db, 'settings', 'tv_config_slides'), sanitizeForFirestore(slidesConfig)),
    ]);
    recordFirestoreUsage('write', 'settings', 'tv_config_*', 'success', undefined, 3);
    console.log(`[DEBUG - syncGlobalConfigToFirestore]: Successfully synced global config.`);
  } catch (err: any) {
    handleFirestoreError(err, 'syncGlobalConfigToFirestore', 'write', 'settings');
  }
}

async function loadGroupsFromFirestore() {
  if (isFirestoreQuotaExhausted) return;
  console.log("Starting loadGroupsFromFirestore...");
  try {
    const snap = await getDocs(collection(db, 'groups'));
    console.log(`loadGroupsFromFirestore: Found ${snap.size} docs.`);
    recordFirestoreUsage('read', 'groups', undefined, 'success', undefined, Math.max(1, snap.size));
    const fsGroups: ScreenGroupData[] = [];
    snap.forEach((d) => {
      fsGroups.push({ id: d.id, ...d.data() } as ScreenGroupData);
    });

    const combinedGroups = [...fsGroups];
    for (const localG of screenGroupsStore) {
      if (localG && localG.id && !combinedGroups.some(g => g.id === localG.id)) {
        combinedGroups.push(localG);
        syncGroupToFirestore(localG).catch((e) => console.error("Sync error:", e));
      }
    }

    if (combinedGroups.length > 0) {
      screenGroupsStore = combinedGroups;
      saveGroups();
      console.log(`loadGroupsFromFirestore: Updated screenGroupsStore with ${screenGroupsStore.length} groups.`);
    }
  } catch (err: any) {
    handleFirestoreError(err, 'loadGroupsFromFirestore', 'read', 'groups');
  }
}

async function syncGroupToFirestore(group: ScreenGroupData) {
  if (isFirestoreQuotaExhausted) return;
  console.log(`[DEBUG - syncGroupToFirestore]: Syncing group ${group.id}...`);
  try {
    await setDoc(doc(db, 'groups', group.id), sanitizeForFirestore(group), { merge: true });
    recordFirestoreUsage('write', 'groups', group.id);
    saveGroups();
    console.log(`[DEBUG - syncGroupToFirestore]: Successfully synced group ${group.id}.`);
  } catch (err: any) {
    handleFirestoreError(err, 'syncGroupToFirestore', 'write', 'groups');
  }
}

async function deleteGroupFromFirestore(groupId: string) {
  if (isFirestoreQuotaExhausted) return;
  try {
    await deleteDoc(doc(db, 'groups', groupId));
    recordFirestoreUsage('delete', 'groups', groupId);
    saveGroups();
  } catch (err: any) {
    handleFirestoreError(err, 'deleteGroupFromFirestore', 'delete', 'groups');
  }
}

let screenDevicesStore: ScreenDeviceData[] = [];

function loadScreens() {
  try {
    if (fs.existsSync(SCREENS_FILE)) {
      const data = fs.readFileSync(SCREENS_FILE, 'utf8');
      screenDevicesStore = JSON.parse(data);
    } else {
      saveScreens();
    }
  } catch (err) {
    console.error("Error loading screens database:", err);
  }
}

function saveScreens() {
  if (process.env.VERCEL) return;
  try {
    fs.writeFileSync(SCREENS_FILE, JSON.stringify(screenDevicesStore, null, 2), 'utf8');
  } catch (err) {
    console.error("Error saving screens database:", err);
  }
}

// Initial load
loadScreens();

const CONFIG_FILE = path.join(process.cwd(), "tv_config.json");
let globalTvConfig: any = null;

function saveGlobalConfig(config: any) {
  if (process.env.VERCEL) return;
  try {
    globalTvConfig = config;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving global tv_config:", err);
  }
}

async function loadGlobalConfig() {
  let localConfig: any = null;
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, "utf8");
      localConfig = JSON.parse(data);
    } catch (e) {
      console.error("Error reading local tv_config.json:", e);
    }
  }

  if (isFirestoreQuotaExhausted) {
    globalTvConfig = localConfig || { sleepMode: { enabled: false }, buildings: [], slides: [] };
    return;
  }

  try {
    // Primary source of truth: Load from Firestore split documents
    const generalDoc = await getDoc(doc(db, 'settings', 'tv_config_general'));
    const bldDoc = await getDoc(doc(db, 'settings', 'tv_config_buildings'));
    const slidesDoc = await getDoc(doc(db, 'settings', 'tv_config_slides'));
    recordFirestoreUsage('read', 'settings', 'tv_config_*', 'success', undefined, 3);
    
    let fsConfig: any = {};
    if (generalDoc.exists()) {
      fsConfig = { ...fsConfig, ...generalDoc.data() };
    }
    if (bldDoc.exists()) {
      fsConfig = { ...fsConfig, ...bldDoc.data() };
    }
    if (slidesDoc.exists()) {
      fsConfig = { ...fsConfig, ...slidesDoc.data() };
    }

    const hasFsContent = fsConfig && (
      (Array.isArray(fsConfig.slides) && fsConfig.slides.length > 0) ||
      (Array.isArray(fsConfig.buildings) && fsConfig.buildings.length > 0)
    );

    if (hasFsContent) {
      // Merge local slides/buildings with Firestore if local disk has additional unique items
      if (localConfig) {
        const mergedSlides = [...(fsConfig.slides || [])];
        if (Array.isArray(localConfig.slides)) {
          for (const s of localConfig.slides) {
            if (s && s.id && !mergedSlides.some(existing => existing.id === s.id)) {
              mergedSlides.push(s);
            }
          }
        }

        const mergedBuildings = [...(fsConfig.buildings || [])];
        if (Array.isArray(localConfig.buildings)) {
          for (const b of localConfig.buildings) {
            if (b && b.id && !mergedBuildings.some(existing => existing.id === b.id)) {
              mergedBuildings.push(b);
            }
          }
        }

        fsConfig.slides = mergedSlides;
        fsConfig.buildings = mergedBuildings;
      }

      globalTvConfig = fsConfig;
      saveGlobalConfig(fsConfig);
      syncGlobalConfigToFirestore(fsConfig).catch(() => {});
      return;
    } else if (localConfig && (localConfig.slides?.length > 0 || localConfig.buildings?.length > 0)) {
      // If Firestore was empty but local file has config, use local & sync up to Firestore!
      globalTvConfig = localConfig;
      syncGlobalConfigToFirestore(localConfig).catch(() => {});
      return;
    }

    globalTvConfig = localConfig || { sleepMode: { enabled: false }, buildings: [], slides: [] };
  } catch (err: any) {
    handleFirestoreError(err, 'loadGlobalConfig', 'read', 'settings');
    if (!globalTvConfig) {
      globalTvConfig = localConfig || { sleepMode: { enabled: false }, buildings: [], slides: [] };
      saveGlobalConfig(globalTvConfig);
    }
  }
}

let publishHistoryStore: PublishHistoryRecord[] = [];

// API: Device Heartbeat (In-memory cache)
app.post("/api/devices/ping", (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ ok: false, error: "Missing deviceId" });
  onlineDevicesCache.set(deviceId, Date.now());
  res.sendStatus(200);
});

// API: Get online devices status
app.get("/api/devices/status", (req, res) => {
  const onlineDevices: Record<string, number> = {};
  for (const [key, value] of onlineDevicesCache.entries()) {
    onlineDevices[key] = value;
  }
  res.json({ ok: true, onlineDevices });
});

// API: Get global TV configuration
app.get("/api/config", async (req, res) => {
  if (!globalTvConfig) {
    await loadGlobalConfig();
  }
  return res.json({
    ok: true,
    config: globalTvConfig || null
  });
});

// API: Save global TV configuration
app.post("/api/config", async (req, res) => {
  const { config } = req.body;
  if (!config) {
    return res.status(400).json({ ok: false, error: "Missing config data" });
  }

  saveGlobalConfig(config);

  if (!isFirestoreQuotaExhausted) {
    // Sync to Firestore split documents asynchronously in the background so it is resilient to quota exhaustion
    (async () => {
      try {
        const generalConfig = { ...config, buildings: [], slides: [] };
        const buildingsConfig = { buildings: config.buildings || [] };
        const slidesConfig = { slides: config.slides || [] };

        await Promise.all([
          setDoc(doc(db, 'settings', 'tv_config_general'), sanitizeForFirestore(generalConfig)),
          setDoc(doc(db, 'settings', 'tv_config_buildings'), sanitizeForFirestore(buildingsConfig)),
          setDoc(doc(db, 'settings', 'tv_config_slides'), sanitizeForFirestore(slidesConfig)),
        ]);
        recordFirestoreUsage('write', 'settings', 'tv_config_*', 'success', undefined, 3);
      } catch (err: any) {
        handleFirestoreError(err, 'saveGlobalConfigToFirestore', 'write', 'settings');
      }
    })();
  }

  return res.json({ ok: true, config: globalTvConfig });
});

// API: Debug & System Status
app.get("/api/debug/system-status", async (req, res) => {
  let fsUserCount = 0;
  let fsGroupCount = 0;
  let adminPwdType = 'unknown';

  try {
    const uSnap = await getDocs(collection(db, 'users'));
    fsUserCount = uSnap.size;
    uSnap.forEach(d => {
      if (d.id === 'admin') {
        const data = d.data();
        const pwd = data.passwordHash || data.password || '';
        adminPwdType = `Custom password set (Hash: ${pwd.substring(0, 8)}...)`;
      }
    });

    const gSnap = await getDocs(collection(db, 'groups'));
    fsGroupCount = gSnap.size;
  } catch (e: any) {
    adminPwdType = `Error reading Firestore: ${e.message}`;
  }

  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    serverMemory: {
      usersCount: usersStore.length,
      groupsCount: screenGroupsStore.length,
      screensCount: screenDevicesStore.length,
      slidesCount: globalTvConfig?.slides?.length || 0,
      buildingsCount: globalTvConfig?.buildings?.length || 0,
    },
    firestoreDB: {
      usersCount: fsUserCount,
      groupsCount: fsGroupCount,
      adminPasswordState: adminPwdType,
      projectId: process.env.FIREBASE_PROJECT_ID || 'N/A',
      databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'N/A',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'N/A',
    },
    sampleGroups: screenGroupsStore.map(g => ({ id: g.id, name: g.name })),
    sampleSlides: (globalTvConfig?.slides || []).map(s => ({ id: s.id, title: s.title }))
  });
});

// API: Firebase Configuration & Diagnostic Info
app.get("/api/firebase/info", (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    config: {
      projectId: process.env.FIREBASE_PROJECT_ID || 'N/A',
      databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'N/A',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'N/A',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || 'N/A',
      appId: process.env.FIREBASE_APP_ID || 'N/A',
      apiKeyMasked: process.env.FIREBASE_API_KEY ? `${process.env.FIREBASE_API_KEY.substring(0, 8)}...${process.env.FIREBASE_API_KEY.substring(process.env.FIREBASE_API_KEY.length - 6)}` : 'N/A',
      apiKeyFull: process.env.FIREBASE_API_KEY || 'N/A',
    },
    quotaExhausted: isFirestoreQuotaExhausted
  });
});

// API: Authentication & Users
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "Vui lòng nhập đầy đủ Người dùng và Mật khẩu" });
  }

  const cleanInput = email.toLowerCase().trim();
  const inputHash = hashSha256Server(password);

  const user = usersStore.find((u) => {
    const uEmail = u.email.toLowerCase().trim();
    const isEmailMatch = (uEmail === cleanInput) ||
      (cleanInput === 'admin' && (uEmail === 'admin' || uEmail === 'zhulivn@gmail.com' || uEmail === 'admin@btc.gov.vn')) ||
      (cleanInput === 'user' && (uEmail === 'user' || uEmail === 'operator@gmail.com' || uEmail === 'user@btc.gov.vn'));

    if (!isEmailMatch) return false;

    const storedHash = normalizePasswordHash(u.password);
    if (storedHash === inputHash) return true;

    // Backward compatibility for double-hashed legacy passwords
    if (hashSha256Server(inputHash) === storedHash) {
      u.password = inputHash;
      saveUsers();
      syncUserToFirestore(u).catch(() => {});
      return true;
    }

    return false;
  });

  if (user) {
    return res.json({
      ok: true,
      user: {
        email: user.email,
        role: user.role,
        name: user.name,
      }
    });
  }

  return res.status(401).json({ ok: false, error: "Tài khoản hoặc mật khẩu không chính xác!" });
});

app.post("/api/auth/change-password", (req, res) => {
  const { email, oldPassword, newPassword } = req.body;
  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({ ok: false, error: "Vui lòng cung cấp đầy đủ thông tin mật khẩu" });
  }

  const targetInput = email.toLowerCase().trim();
  const oldHash = hashSha256Server(oldPassword);
  const newHash = hashSha256Server(newPassword);

  const userIdx = usersStore.findIndex((u) => {
    const uEmail = u.email.toLowerCase().trim();
    if (uEmail === targetInput) return true;
    if (targetInput === 'admin' && (uEmail === 'admin' || uEmail === 'zhulivn@gmail.com' || uEmail === 'admin@btc.gov.vn')) return true;
    if (targetInput === 'user' && (uEmail === 'user' || uEmail === 'operator@gmail.com' || uEmail === 'user@btc.gov.vn')) return true;
    return false;
  });

  if (userIdx >= 0) {
    const storedHash = normalizePasswordHash(usersStore[userIdx].password);
    const isOldCorrect = (storedHash === oldHash) || (hashSha256Server(oldHash) === storedHash);

    if (isOldCorrect) {
      usersStore[userIdx].password = newHash;
      saveUsers();
      syncUserToFirestore(usersStore[userIdx]).catch(() => {});
      
      // Log password change to history
      const now = Date.now();
      const publishedAtStr = new Date(now).toLocaleString('vi-VN');
      const historyItem: PublishHistoryRecord = {
        id: `log-${now}`,
        publishedAt: publishedAtStr,
        targetSummary: 'Hệ thống tài khoản',
        targetType: 'log',
        affectedScreensCount: 0,
        configSnapshot: {
          title: `Người dùng ${usersStore[userIdx].name} (${usersStore[userIdx].email}) thay đổi mật khẩu tài khoản thành công.`,
        },
        publisherEmail: usersStore[userIdx].email,
        publisherName: usersStore[userIdx].name,
      };
      publishHistoryStore.unshift(historyItem);
      if (publishHistoryStore.length > 30) publishHistoryStore.pop();
      
      return res.json({ ok: true, message: "Đổi mật khẩu thành công!" });
    } else {
      return res.status(400).json({ ok: false, error: "Mật khẩu cũ không chính xác!" });
    }
  }

  return res.status(404).json({ ok: false, error: "Không tìm thấy tài khoản người dùng!" });
});

// API: Logging action
app.post("/api/history/log", (req, res) => {
  const { title, targetSummary, affectedScreensCount, publisherEmail, publisherName } = req.body;
  const now = Date.now();
  const publishedAtStr = new Date(now).toLocaleString('vi-VN');
  
  const historyItem: PublishHistoryRecord = {
    id: `log-${now}`,
    publishedAt: publishedAtStr,
    targetSummary: targetSummary || 'Hệ thống',
    targetType: 'log',
    affectedScreensCount: affectedScreensCount || 0,
    configSnapshot: {
      title: title || 'Thao tác hệ thống',
    },
    publisherEmail: publisherEmail || 'N/A',
    publisherName: publisherName || 'N/A',
  };

  publishHistoryStore.unshift(historyItem);
  if (publishHistoryStore.length > 30) publishHistoryStore.pop();

  return res.json({ ok: true, historyItem });
});

// Helper to normalize and match screen ID case-insensitively and dash-insensitively
function normalizeScreenId(id?: string): string {
  if (!id) return '';
  return id
    .trim()
    .toUpperCase()
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, '-');
}

function findScreenById(id?: string) {
  if (!id) return null;
  const clean = normalizeScreenId(id);
  return screenDevicesStore.find((s) => normalizeScreenId(s.id) === clean);
}

// Helper to auto-pick best matching group for a screen based on building & zone
function findBestGroupForScreen(buildingId?: string, zone?: string): string {
  const bld = buildingId || 'building-a';
  const zn = zone || 'lobby';

  const group = screenGroupsStore.find((g) => {
    const matchesBld = !g.buildingId || g.buildingId === bld;
    if (!matchesBld) return false;
    const gName = (g.name || '').toLowerCase();
    const gCode = (g.code || '').toLowerCase();
    if (zn === 'lobby') {
      return gName.includes('sảnh') || gName.includes('lobby') || gCode.includes('sanh') || gCode.includes('lobby');
    } else {
      return gName.includes('cabin') || gCode.includes('cabin');
    }
  });

  if (group) return group.id;

  const bldGroup = screenGroupsStore.find((g) => !g.buildingId || g.buildingId === bld);
  if (bldGroup) return bldGroup.id;

  return screenGroupsStore[0]?.id || '';
}

// API: Get Screen Groups & Devices state
app.get("/api/screens/state", async (req, res) => {
  await loadGroupsFromFirestore();
  await loadScreensFromFirestore();
  const now = Date.now();
  
  const updatedScreens = screenDevicesStore.map((scr) => ({
    ...scr,
    // Use the LRU cache for real-time status, fallback to lastSeen for offline detection
    status: (onlineDevicesCache.has(scr.id) || (now - scr.lastSeen < 60000)) ? 'online' : 'offline',
  }));

  return res.json({
    ok: true,
    groups: screenGroupsStore,
    screens: updatedScreens,
    publishHistory: publishHistoryStore,
  });
});

// API: Device Heartbeat (Call from screens to report online status & fetch assigned config)
app.post("/api/screens/heartbeat", async (req, res) => {
  const { screenId, name, groupId, ipAddress } = req.body;
  const now = Date.now();

  const cleanId = normalizeScreenId(screenId);
  // Update heartbeat in cache
  onlineDevicesCache.set(cleanId, now);

  let screen = findScreenById(cleanId);

  // If screen is missing or not approved in RAM, reload from Firestore to verify if Admin approved it
  if (!screen || !screen.approved) {
    await loadScreensFromFirestore();
    screen = findScreenById(cleanId);
  }

  const defaultApprovedIds = ['SCR-LOBBY-A1', 'SCR-LOBBY-A2', 'SCR-CABIN-A1', 'SCR-CABIN-A2', 'SCR-LOBBY-B1', 'SCR-CABIN-B1'];
  const isDefaultApproved = defaultApprovedIds.some(d => d.toLowerCase() === cleanId.toLowerCase());

  if (!screen) {
    const defaultGroup = findBestGroupForScreen('building-a', 'lobby');
    screen = {
      id: cleanId || `SCR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      name: name || `Màn hình ${cleanId}`,
      groupId: groupId && groupId !== 'grp-1' && screenGroupsStore.some(g => g.id === groupId) ? groupId : defaultGroup,
      buildingId: 'building-a',
      zone: 'lobby',
      status: 'online',
      lastSeen: now, // Initial lastSeen for new device
      ipAddress: ipAddress || req.ip || '127.0.0.1',
      resolution: '1920x1080 (16:9)',
      approved: isDefaultApproved, // Default screens start as approved
      requestedAt: now,
    };
    screenDevicesStore.push(screen);
    saveScreens(); // New screen, save to JSON
    syncScreenToFirestore(screen).catch(() => {});
  } else {
    if (isDefaultApproved && !screen.approved) {
      screen.approved = true;
    }
    // Only update persistent data if necessary (don't save on every heartbeat)
    let needsSave = false;
    if (ipAddress && screen.ipAddress !== ipAddress) {
      screen.ipAddress = ipAddress;
      needsSave = true;
    }

    if (req.body.buildingId && screen.buildingId !== req.body.buildingId) {
      screen.buildingId = req.body.buildingId;
      needsSave = true;
    }
    if (req.body.zone && screen.zone !== req.body.zone) {
      screen.zone = req.body.zone;
      needsSave = true;
    }
    
    // Auto fix screen.groupId if missing, invalid, or dummy 'grp-1'
    if (!screen.groupId || screen.groupId === 'grp-1' || !screenGroupsStore.some(g => g.id === screen.groupId)) {
      if (groupId && groupId !== 'grp-1' && screenGroupsStore.some(g => g.id === groupId)) {
        screen.groupId = groupId;
        needsSave = true;
      } else {
        screen.groupId = findBestGroupForScreen(screen.buildingId, screen.zone);
        needsSave = true;
      }
    }
    
    if (needsSave) {
        saveScreens();
        syncScreenToFirestore(screen).catch(() => {});
    }
  }

  return res.json({
    ok: true,
    screenId: screen.id,
    buildingId: screen.buildingId,
    zone: screen.zone,
    groupId: screen.groupId,
    assignedConfig: screen.assignedConfig || null,
    serverTime: now,
    approved: screen.approved === true, // Return exact boolean approval status
  });
});

// API: Add/Update Screen Group
app.post("/api/screens/groups", async (req, res) => {
  const { id, name, code, description, buildingId } = req.body;
  if (!name || !code) {
    return res.status(400).json({ ok: false, error: "Tên nhóm và Mã nhóm không được để trống" });
  }

  const existingIdx = screenGroupsStore.findIndex((g) => g.id === id);
  let targetGroup: ScreenGroupData;
  if (existingIdx >= 0) {
    targetGroup = {
      ...screenGroupsStore[existingIdx],
      name,
      code,
      description,
      buildingId,
    };
    screenGroupsStore[existingIdx] = targetGroup;
  } else {
    targetGroup = {
      id: id || `grp-${Date.now()}`,
      name,
      code,
      description,
      buildingId: buildingId || 'building-a',
    };
    screenGroupsStore.push(targetGroup);
  }

  syncGroupToFirestore(targetGroup).catch(() => {});

  return res.json({ ok: true, groups: screenGroupsStore });
});

// API: Delete Screen Group
app.delete("/api/screens/groups/:id", async (req, res) => {
  const { id } = req.params;
  screenGroupsStore = screenGroupsStore.filter((g) => g.id !== id);
  deleteGroupFromFirestore(id).catch(() => {});
  return res.json({ ok: true, groups: screenGroupsStore });
});

// API: Add/Update Screen Device
app.post("/api/screens/devices", async (req, res) => {
  const { id, name, groupId, buildingId, zone, ipAddress, resolution, approved } = req.body;
  if (!name || !groupId) {
    return res.status(400).json({ ok: false, error: "Tên màn hình và Nhóm không được để trống" });
  }

  const cleanId = (id || '').trim();
  let targetScreen: ScreenDeviceData;
  const existingIdx = screenDevicesStore.findIndex((s) => s.id.trim().toLowerCase() === cleanId.toLowerCase());

  if (existingIdx >= 0) {
    screenDevicesStore[existingIdx] = {
      ...screenDevicesStore[existingIdx],
      id: screenDevicesStore[existingIdx].id || cleanId,
      name,
      groupId,
      buildingId: buildingId || screenDevicesStore[existingIdx].buildingId,
      zone: zone || screenDevicesStore[existingIdx].zone,
      ipAddress: ipAddress || screenDevicesStore[existingIdx].ipAddress,
      resolution: resolution || screenDevicesStore[existingIdx].resolution,
      approved: approved !== undefined ? Boolean(approved) : (screenDevicesStore[existingIdx].approved ?? true),
      lastSeen: Date.now(),
      status: 'online',
    };
    targetScreen = screenDevicesStore[existingIdx];
  } else {
    targetScreen = {
      id: cleanId || `SCR-${Date.now()}`,
      name,
      groupId,
      buildingId: buildingId || 'building-a',
      zone: zone || 'lobby',
      status: 'online',
      lastSeen: Date.now(),
      ipAddress: ipAddress || '192.168.1.100',
      resolution: resolution || '1920x1080 (16:9)',
      approved: approved !== undefined ? Boolean(approved) : true,
    };
    screenDevicesStore.push(targetScreen);
  }
  saveScreens();
  syncScreenToFirestore(targetScreen).catch(() => {});

  return res.json({ ok: true, screens: screenDevicesStore });
});

// API: Delete Screen Device
app.delete("/api/screens/devices/:id", async (req, res) => {
  const { id } = req.params;
  const decodedId = decodeURIComponent(id).trim().toLowerCase();
  const target = screenDevicesStore.find(s => s.id.trim().toLowerCase() === decodedId || s.name.toLowerCase() === decodedId);
  const actualId = target ? target.id : decodedId;

  screenDevicesStore = screenDevicesStore.filter((s) => s.id.trim().toLowerCase() !== decodedId && s.name.toLowerCase() !== decodedId && s.id !== actualId);
  saveScreens();
  removeScreenFromFirestore(actualId).catch(() => {});
  if (target && target.id !== actualId) {
    removeScreenFromFirestore(target.id).catch(() => {});
  }
  return res.json({ ok: true, screens: screenDevicesStore });
});

// API: Approve Screen Device
app.post("/api/screens/approve", async (req, res) => {
  const { screenId, name, groupId, buildingId, zone } = req.body;
  const cleanId = normalizeScreenId(screenId);
  let screen = findScreenById(cleanId);

  const targetBld = buildingId || 'building-a';
  const targetZone = zone || 'lobby';
  const validGroup = (groupId && groupId !== 'grp-1' && screenGroupsStore.some(g => g.id === groupId)) 
    ? groupId 
    : findBestGroupForScreen(targetBld, targetZone);

  if (!screen) {
    screen = {
      id: cleanId,
      name: name || `Màn hình ${cleanId}`,
      groupId: validGroup,
      buildingId: targetBld,
      zone: targetZone,
      status: 'online',
      lastSeen: Date.now(),
      ipAddress: '192.168.1.100',
      resolution: '1920x1080 (16:9)',
      approved: true,
    };
    screenDevicesStore.push(screen);
  } else {
    screen.approved = true;
    if (name) screen.name = name;
    screen.groupId = validGroup;
    if (buildingId) screen.buildingId = buildingId;
    if (zone) screen.zone = zone;
    screen.lastSeen = Date.now();
    screen.status = 'online';
  }
  saveScreens();
  syncScreenToFirestore(screen).catch(() => {});
  return res.json({ ok: true, screens: screenDevicesStore });
});

// API: Revoke/Disapprove Screen Device (Lock)
app.post("/api/screens/revoke", async (req, res) => {
  const { screenId } = req.body;
  const cleanId = (screenId || '').trim().toUpperCase();
  let screen = findScreenById(cleanId);
  if (!screen) {
    screen = {
      id: cleanId,
      name: `Màn hình ${cleanId}`,
      groupId: screenGroupsStore[0]?.id || '',
      buildingId: 'building-a',
      zone: 'lobby',
      status: 'online',
      lastSeen: Date.now(),
      ipAddress: '192.168.1.100',
      resolution: '1920x1080 (16:9)',
      approved: false,
    };
    screenDevicesStore.push(screen);
  } else {
    screen.approved = false;
  }
  saveScreens();
  syncScreenToFirestore(screen).catch(() => {});
  return res.json({ ok: true, screens: screenDevicesStore });
});

// API: Publish targeted content update to specific Groups or Screens
app.post("/api/screens/publish", async (req, res) => {
  const { targetType, targetGroupIds, targetScreenIds, config, title, publisherEmail, publisherName } = req.body;
  if (!config) {
    return res.status(400).json({ ok: false, error: "Nội dung cấu hình đẩy lên không hợp lệ" });
  }

  let affectedScreens: ScreenDeviceData[] = [];

  if (targetType === 'all') {
    affectedScreens = screenDevicesStore;
  } else if (targetType === 'groups') {
    const groupSet = new Set(targetGroupIds || []);
    affectedScreens = screenDevicesStore.filter((s) => groupSet.has(s.groupId));
  } else if (targetType === 'screens') {
    const screenSet = new Set(targetScreenIds || []);
    affectedScreens = screenDevicesStore.filter((s) => screenSet.has(s.id));
  }

  // Update assignedConfig for affected screens
  const now = Date.now();
  const publishedAtStr = new Date(now).toLocaleString('vi-VN');

  for (const scr of affectedScreens) {
    scr.assignedConfig = {
      ...scr.assignedConfig,
      ...config,
      publishedAt: publishedAtStr,
    };
    syncScreenToFirestore(scr).catch(() => {});
  }
  saveScreens();

  // Record history
  let targetSummary = 'Toàn bộ màn hình hệ thống';
  if (targetType === 'groups') {
    const groupNames = screenGroupsStore
      .filter((g) => (targetGroupIds || []).includes(g.id))
      .map((g) => g.name);
    targetSummary = `Các nhóm: ${groupNames.join(', ')}`;
  } else if (targetType === 'screens') {
    const screenNames = affectedScreens.map((s) => s.name);
    targetSummary = `Các màn hình: ${screenNames.join(', ')}`;
  }

  const historyItem: PublishHistoryRecord = {
    id: `pub-${now}`,
    publishedAt: publishedAtStr,
    targetSummary,
    targetType: targetType || 'all',
    affectedScreensCount: affectedScreens.length,
    configSnapshot: {
      organizationText: config.organizationText,
      marqueeText: config.marqueeText,
      slidesCount: config.slides?.length || 0,
      title: title || 'Cập nhật nội dung truyền thông',
    },
    publisherEmail: publisherEmail || 'Hệ thống',
    publisherName: publisherName || 'Tự động',
  };

  publishHistoryStore.unshift(historyItem);
  if (publishHistoryStore.length > 30) publishHistoryStore.pop(); // Keep max 30

  return res.json({
    ok: true,
    message: `Đã phát tin thành công tới ${affectedScreens.length} màn hình!`,
    affectedCount: affectedScreens.length,
    historyItem,
    screens: screenDevicesStore,
  });
});

// API: Serve uploaded media by ID
app.get("/api/media/:id", (req, res) => {
  const { id } = req.params;
  const media = uploadedMedia.get(id);
  if (!media || !media.data) {
    return res.status(404).send("Media not found");
  }
  try {
    const base64 = media.data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    res.setHeader("Content-Type", media.mimeType || "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    return res.send(buffer);
  } catch (err) {
    return res.status(500).send("Error rendering media");
  }
});

// API: Upload image endpoint
app.post("/api/upload", (req, res) => {
  const { name, data, mimeType } = req.body;
  if (!data) {
    return res.status(400).json({ ok: false, error: "Dữ liệu ảnh không hợp lệ" });
  }

  const id = "img_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const mediaObj = {
    id,
    name: name || "quang_cao_thang_may.png",
    url: `/api/media/${id}`,
    data,
    mimeType: mimeType || "image/png",
  };

  uploadedMedia.set(id, mediaObj);
  saveMedia();
  syncMediaToFirestore(mediaObj).catch(() => {});

  return res.json({
    ok: true,
    id,
    url: mediaObj.url,
    name: mediaObj.name,
  });
});

// API: Delete uploaded media endpoint
app.delete("/api/upload/:id", (req, res) => {
  const { id } = req.params;
  if (uploadedMedia.has(id)) {
    uploadedMedia.delete(id);
    saveMedia();
    deleteMediaFromFirestore(id).catch(() => {});
  }
  return res.json({ ok: true, message: "Đã xóa ảnh khỏi bộ nhớ máy chủ" });
});

// API: Proxy URL to bypass X-Frame-Options for TV display
app.get("/api/proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send("URL parameter required");
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const response = await fetch(parsedUrl.href, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (CrKey; Large Screen; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 Android TV",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });

    const contentType = response.headers.get("content-type") || "text/html";
    res.setHeader("Content-Type", contentType);

    // If html content, inject base tag so relative resources load from origin
    if (contentType.includes("text/html")) {
      let body = await response.text();
      const baseTag = `<head><base href="${parsedUrl.origin}/">`;
      if (body.includes("<head>")) {
        body = body.replace("<head>", baseTag);
      } else {
        body = baseTag + body;
      }
      
      // Specific fix for vbdhbtc.mof.gov.vn calendar to fit in portrait mode
      if (parsedUrl.hostname.includes('vbdhbtc.mof.gov.vn')) {
        // Fix the calendar iframe script to use proxy, avoiding port override issues
        body = body.replace(/iframe\.src = host;/g, 
                            `iframe.src = "/api/proxy?url=" + encodeURIComponent("https://vbdhbtc.mof.gov.vn/eboard.html");`);
        
        // Inject custom CSS to make the calendar fit in portrait without losing content
        const customCSS = `
          <style>
            /* Force table and columns to adapt to portrait mode */
            @media screen and (orientation: portrait), screen and (max-width: 1200px) {
              body {
                margin: 0 !important;
                padding: 0 !important;
                overflow-x: hidden !important;
              }
              table {
                table-layout: fixed !important;
                width: 100% !important;
              }
              .p-datatable .p-datatable-wrapper {
                overflow-x: hidden !important;
              }
              .p-datatable .p-datatable-tbody > tr > td, 
              .p-datatable .p-datatable-thead > tr > th {
                font-size: 20px !important;
                padding: 10px 8px !important;
                word-wrap: break-word !important;
                word-break: break-word !important;
                white-space: normal !important;
              }
              #edoc-calendar-title {
                font-size: 28px !important;
                margin-top: 10px !important;
                margin-bottom: 10px !important;
              }
              /* For calendar.html wrapper */
              .box-iframe {
                width: 100vw !important;
                height: 100vh !important;
                border: none !important;
              }
            }
          </style>
        `;
        body = body.replace('</head>', customCSS + '</head>');
      }

      return res.send(body);
    }

    // For non-HTML resources
    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (error: any) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          .card { background: #1e293b; border: 1px solid #334155; padding: 40px; border-radius: 16px; max-width: 500px; }
          h1 { color: #f43f5e; font-size: 24px; margin-bottom: 12px; }
          p { color: #94a3b8; font-size: 16px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Không thể tải trang web</h1>
          <p>Lỗi kết nối tới: <strong>${targetUrl}</strong></p>
          <p>${error?.message || "Vui lòng kiểm tra lại đường dẫn URL hoặc kết nối mạng."}</p>
        </div>
      </body>
      </html>
    `);
  }
});

// API: Check URL Status
// API: Firestore Quota & Usage Logging Status
app.get("/api/admin/firestore-usage", (req, res) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayUsage = firestoreDailyUsage[todayStr] || {
    date: todayStr,
    reads: 0,
    writes: 0,
    deletes: 0,
  };

  const limits = {
    freeDailyReads: 50000,
    freeDailyWrites: 20000,
    freeDailyDeletes: 20000,
  };

  const readPercent = Math.min(100, (todayUsage.reads / limits.freeDailyReads) * 100);
  const writePercent = Math.min(100, (todayUsage.writes / limits.freeDailyWrites) * 100);
  const deletePercent = Math.min(100, (todayUsage.deletes / limits.freeDailyDeletes) * 100);

  const maxPercent = Math.max(readPercent, writePercent, deletePercent);
  let statusLevel: 'normal' | 'warning' | 'critical' | 'exhausted' = 'normal';
  if (isFirestoreQuotaExhausted || maxPercent >= 100) {
    statusLevel = 'exhausted';
  } else if (maxPercent >= 80) {
    statusLevel = 'critical';
  } else if (maxPercent >= 50) {
    statusLevel = 'warning';
  }

  const history = Object.values(firestoreDailyUsage)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);

  return res.json({
    ok: true,
    today: todayStr,
    isQuotaExhausted: isFirestoreQuotaExhausted,
    statusLevel,
    todayUsage,
    limits,
    percents: {
      readPercent: Number(readPercent.toFixed(1)),
      writePercent: Number(writePercent.toFixed(1)),
      deletePercent: Number(deletePercent.toFixed(1)),
    },
    history,
    recentLogs: firestoreApiLogs.slice(0, 100),
  });
});

app.post("/api/admin/firestore-usage/clear-logs", (req, res) => {
  firestoreApiLogs = [];
  saveFirestoreUsageStores();
  return res.json({ ok: true });
});

app.post("/api/admin/firestore-log", (req, res) => {
  const { operation, collection, docId, status, message, count } = req.body;
  if (!operation || !collection) {
    return res.status(400).json({ ok: false, error: "Missing required parameters" });
  }
  recordFirestoreUsage(
    operation,
    collection,
    docId,
    status || 'success',
    message,
    typeof count === 'number' ? count : 1
  );
  return res.json({ ok: true });
});

app.get("/api/check-url", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.json({ ok: false, error: "Missing URL" });

  try {
    const parsed = new URL(targetUrl);
    const resp = await fetch(parsed.href, { method: "HEAD" });
    const frameOptions = resp.headers.get("x-frame-options");
    const csp = resp.headers.get("content-security-policy");
    const blockedByIframe =
      !!frameOptions || (!!csp && csp.includes("frame-ancestors"));

    return res.json({
      ok: resp.ok,
      status: resp.status,
      blockedByIframe,
    });
  } catch (err: any) {
    return res.json({ ok: false, error: err.message });
  }
});

async function start() {
  console.log("[DEBUG - App Initialization]: Starting application initialization...");
  await loadGlobalConfig();
  console.log("[DEBUG - App Initialization]: Global config loaded.");
  await loadGroupsFromFirestore();
  console.log("[DEBUG - App Initialization]: Groups loaded.");
  await loadScreensFromFirestore();
  console.log("[DEBUG - App Initialization]: Screens loaded.");
  await loadUsersFromFirestore();
  console.log("[DEBUG - App Initialization]: Users loaded.");
  await loadMediaFromFirestore();
  console.log("[DEBUG - App Initialization]: Media loaded.");

  if (process.env.NODE_ENV !== "production") {
    const isHmrDisabled = process.env.DISABLE_HMR === "true";
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : true,
        watch: isHmrDisabled ? null : {},
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Android TV Web App listening on http://0.0.0.0:${PORT}`);
    });

    server.on('error', (e: any) => {
      if (e.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use.`);
      } else {
        console.error('Server error:', e);
      }
    });
  }
}

start().catch(err => {
  console.error("Failed to start server:", err);
});

export default app;
