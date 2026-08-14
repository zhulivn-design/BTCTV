import {
  db,
  doc,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  onSnapshot,
} from './firebase';
import { ScreenDevice, ScreenGroup, PublishHistoryItem, TVConfig } from '../types';

// Helper to remove `undefined` values recursively before passing to Firestore
export function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result;
}

// Helper to execute promises with a timeout safety net so the UI never hangs
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 4000, fallbackValue?: T): Promise<T> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | null = setTimeout(() => {
      timer = null;
      console.warn(`Firestore operation timed out after ${timeoutMs}ms`);
      resolve(fallbackValue as T);
    }, timeoutMs);

    promise
      .then((res) => {
        if (timer) {
          clearTimeout(timer);
          resolve(res);
        }
      })
      .catch((err) => {
        if (timer) {
          clearTimeout(timer);
          console.warn('Firestore operation error:', err);
          resolve(fallbackValue as T);
        }
      });
  });
}

/**
 * Save Global Config directly to Firestore (settings/tv_config_v2)
 */
export async function saveGlobalConfigFirestore(config: TVConfig): Promise<boolean> {
  const sanitized = sanitizeForFirestore(config);

  try {
    // 1. Direct write to Firestore settings/tv_config_v2 with 3.5s timeout safety
    await withTimeout(setDoc(doc(db, 'settings', 'tv_config_v2'), sanitized, { merge: true }), 3500);

    // Also sync all groups to the groups collection
    if (Array.isArray(config.screenGroups)) {
      for (const grp of config.screenGroups) {
        if (grp && grp.id) {
          setDoc(doc(db, 'groups', grp.id), sanitizeForFirestore(grp), { merge: true }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('Direct Firestore save notice:', err);
  }

  // 2. Secondary Express API call in background (non-blocking)
  // safeApiFetch removed

  return true;
}

/**
 * Real-time subscription to Global Config in Firestore.
 * Fires callback whenever config changes on ANY device anywhere in the world!
 */
export function subscribeGlobalConfigFirestore(
  onUpdate: (config: TVConfig) => void,
  onError?: (err: any) => void
): () => void {
  const configDocRef = doc(db, 'settings', 'tv_config_v2');

  const unsubscribe = onSnapshot(
    configDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as TVConfig;
        if (data && typeof data === 'object') {
          onUpdate(data);
        }
      }
    },
    (err) => {
      console.warn('Firestore global config subscription notice:', err);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
}

/**
 * Real-time subscription to a SINGLE Screen Document in Firestore.
 * Extremely quota-efficient: 1 read on connect, 1 read ONLY when this specific screen is approved/updated by Admin!
 */
export function subscribeSingleScreenFirestore(
  screenId: string,
  onUpdate: (screen: ScreenDevice | null) => void
): () => void {
  const docRef = doc(db, 'screens', screenId);

  const unsubscribe = onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate({ id: snapshot.id, ...snapshot.data() } as ScreenDevice);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.warn(`Firestore screen ${screenId} subscription notice:`, err);
    }
  );

  return unsubscribe;
}

/**
 * Real-time subscription to Screens Collection in Firestore (for Admin views only).
 */
export function subscribeScreensFirestore(
  onUpdate: (screens: ScreenDevice[]) => void
): () => void {
  const screensColRef = collection(db, 'screens');

  const unsubscribe = onSnapshot(
    screensColRef,
    (snapshot) => {
      const screens: ScreenDevice[] = [];
      snapshot.forEach((dSnap) => {
        if (dSnap.exists()) {
          screens.push({ id: dSnap.id, ...dSnap.data() } as ScreenDevice);
        }
      });
      onUpdate(screens);
    },
    (err) => {
      console.warn('Firestore screens subscription notice:', err);
    }
  );

  return unsubscribe;
}

/**
 * Real-time subscription to Groups Collection in Firestore.
 */
export function subscribeGroupsFirestore(
  onUpdate: (groups: ScreenGroup[]) => void
): () => void {
  const groupsColRef = collection(db, 'groups');

  const unsubscribe = onSnapshot(
    groupsColRef,
    (snapshot) => {
      const groups: ScreenGroup[] = [];
      snapshot.forEach((dSnap) => {
        if (dSnap.exists()) {
          groups.push({ id: dSnap.id, ...dSnap.data() } as ScreenGroup);
        }
      });
      onUpdate(groups);
    },
    (err) => {
      console.warn('Firestore groups subscription notice:', err);
    }
  );

  return unsubscribe;
}

/**
 * Fetch initial combined state from Firestore (and API fallback).
 */
export async function fetchFirestoreState(): Promise<{
  screens: ScreenDevice[];
  groups: ScreenGroup[];
  history: PublishHistoryItem[];
  config?: TVConfig | null;
}> {
  let screens: ScreenDevice[] = [];
  let groups: ScreenGroup[] = [];
  let history: PublishHistoryItem[] = [];
  let config: TVConfig | null = null;

  // 1. Primary: Direct Firestore Client SDK
  try {
    const [sSnap, gSnap, hSnap, cSnap] = await Promise.all([
      getDocs(collection(db, 'screens')),
      getDocs(collection(db, 'groups')),
      getDocs(collection(db, 'history')),
      getDoc(doc(db, 'settings', 'tv_config_v2')),
    ]);

    sSnap.forEach((d) => screens.push({ id: d.id, ...d.data() } as ScreenDevice));
    gSnap.forEach((d) => groups.push({ id: d.id, ...d.data() } as ScreenGroup));
    hSnap.forEach((d) => history.push({ id: d.id, ...d.data() } as PublishHistoryItem));
    if (cSnap.exists()) {
      config = cSnap.data() as TVConfig;
    }
  } catch (err) {
    console.warn('Error fetching direct Firestore state:', err);
  }

  // 2. Fallback to API if Firestore was empty or failed
  if (screens.length === 0 && groups.length === 0) {
    try {
      const resp = await fetch('/api/screens/state');
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.ok) {
          screens = data.screens || screens;
          groups = data.groups || groups;
          history = data.publishHistory || history;
        }
      }
    } catch {
      // ignore
    }
  }

  return { screens, groups, history, config };
}

export async function upsertScreenFirestore(screen: ScreenDevice): Promise<void> {
  try {
    await setDoc(doc(db, 'screens', screen.id), sanitizeForFirestore(screen), { merge: true });
  } catch (err) {
    console.warn('Direct Firestore screen upsert error:', err);
  }
}

export async function approveScreenFirestore(
  screenId: string,
  name: string,
  groupId: string,
  buildingId: string,
  zone: string
): Promise<void> {
  const payload = {
    id: screenId,
    name,
    groupId,
    buildingId,
    zone,
    approved: true,
    lastSeen: new Date().toISOString(),
    status: 'online',
  };

  try {
    await setDoc(doc(db, 'screens', screenId), sanitizeForFirestore(payload), { merge: true });
  } catch (err) {
    console.warn('Direct Firestore approve screen error:', err);
  }
}

export async function revokeScreenFirestore(screenId: string): Promise<void> {
  try {
    await setDoc(
      doc(db, 'screens', screenId),
      sanitizeForFirestore({ approved: false, status: 'revoked', updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Direct Firestore revoke error:', err);
  }
}

export async function upsertGroupFirestore(group: ScreenGroup): Promise<void> {
  try {
    await setDoc(doc(db, 'groups', group.id), sanitizeForFirestore(group), { merge: true });

    // Also sync with tv_config_v2 screenGroups array
    const cfgSnap = await getDoc(doc(db, 'settings', 'tv_config_v2'));
    if (cfgSnap.exists()) {
      const currentConfig = cfgSnap.data() as TVConfig;
      const existingGroups = currentConfig.screenGroups || [];
      const idx = existingGroups.findIndex((g) => g.id === group.id);
      let updatedGroups;
      if (idx >= 0) {
        updatedGroups = [...existingGroups];
        updatedGroups[idx] = group;
      } else {
        updatedGroups = [...existingGroups, group];
      }
      await setDoc(doc(db, 'settings', 'tv_config_v2'), { screenGroups: updatedGroups }, { merge: true });
    }
  } catch (err) {
    console.warn('Direct Firestore group upsert error:', err);
  }
}

export async function deleteGroupFirestore(groupId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'groups', groupId));

    const cfgSnap = await getDoc(doc(db, 'settings', 'tv_config_v2'));
    if (cfgSnap.exists()) {
      const currentConfig = cfgSnap.data() as TVConfig;
      const updatedGroups = (currentConfig.screenGroups || []).filter((g) => g.id !== groupId);
      await setDoc(doc(db, 'settings', 'tv_config_v2'), { screenGroups: updatedGroups }, { merge: true });
    }
  } catch (err) {
    console.warn('Direct Firestore delete group error:', err);
  }
}

export async function deleteScreenFirestore(screenId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'screens', screenId));
  } catch (err) {
    console.warn('Direct Firestore delete screen error:', err);
  }
}

export async function publishConfigFirestore(
  affectedScreens: ScreenDevice[],
  config: any,
  historyItem: PublishHistoryItem
): Promise<void> {
  // 1. Save config to Firestore directly with timeout
  await saveGlobalConfigFirestore(config);

  // 2. Add history entry with 3s timeout
  try {
    const histId = 'hist-' + Date.now();
    await withTimeout(
      setDoc(doc(db, 'history', histId), sanitizeForFirestore({ id: histId, ...historyItem }), {
        merge: true,
      }),
      3000
    );
  } catch (err) {
    console.warn('Direct Firestore publish history log notice:', err);
  }

  // 3. API fallback in background (non-blocking)
  // safeApiFetch removed
}

export async function logHistoryFirestore(item: PublishHistoryItem): Promise<void> {
  try {
    const histId = 'hist-' + Date.now();
    await withTimeout(
      setDoc(doc(db, 'history', histId), sanitizeForFirestore({ id: histId, ...item }), {
        merge: true,
      }),
      3000
    );
  } catch (err) {
    console.warn('Direct Firestore log history notice:', err);
  }

  // 3. API fallback in background (non-blocking)
  // safeApiFetch removed
}

export async function getFirestoreUser(
  usernameOrEmail: string
): Promise<{ email: string; passwordHash: string; role: 'admin' | 'operator'; name: string } | null> {
  try {
    const cleanId = usernameOrEmail.toLowerCase().trim();
    const userDocRef = doc(db, 'users', cleanId);
    const uSnap = await getDoc(userDocRef);

    if (uSnap.exists()) {
      const uData = uSnap.data();
      return {
        email: cleanId,
        passwordHash: uData.passwordHash || uData.password || '',
        role: uData.role || (cleanId.includes('admin') ? 'admin' : 'operator'),
        name: uData.name || cleanId,
      };
    }

    if (cleanId === 'admin' || cleanId.includes('admin')) {
      return { email: cleanId, passwordHash: '', role: 'admin', name: 'Administrator' };
    }
    return { email: cleanId, passwordHash: '', role: 'operator', name: cleanId };
  } catch {
    const cleanId = usernameOrEmail.toLowerCase().trim();
    if (cleanId === 'admin' || cleanId.includes('admin')) {
      return { email: cleanId, passwordHash: '', role: 'admin', name: 'Administrator' };
    }
    return { email: cleanId, passwordHash: '', role: 'operator', name: cleanId };
  }
}

export async function updateFirestoreUserPassword(
  usernameOrEmail: string,
  newPasswordHash: string,
  role: 'admin' | 'operator',
  name: string
): Promise<void> {
  try {
    const cleanId = usernameOrEmail.toLowerCase().trim();
    await setDoc(
      doc(db, 'users', cleanId),
      sanitizeForFirestore({
        email: cleanId,
        passwordHash: newPasswordHash,
        role,
        name,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Direct Firestore user update error:', err);
  }

  try {
    await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: usernameOrEmail,
        oldPassword: '',
        newPassword: newPasswordHash,
      }),
    });
  } catch {
    // ignore
  }
}
