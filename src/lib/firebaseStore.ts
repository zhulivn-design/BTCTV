import { ScreenDevice, ScreenGroup, PublishHistoryItem, TVConfig } from '../types';

export async function fetchFirestoreState(): Promise<{
  screens: ScreenDevice[];
  groups: ScreenGroup[];
  history: PublishHistoryItem[];
}> {
  try {
    const resp = await fetch('/api/screens/state');
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.ok) {
        return {
          screens: data.screens || [],
          groups: data.groups || [],
          history: data.publishHistory || [],
        };
      }
    }
  } catch (err) {
    console.warn('Error fetching server screens state, falling back:', err);
  }
  return { screens: [], groups: [], history: [] };
}

export async function upsertScreenFirestore(screen: ScreenDevice): Promise<void> {
  try {
    await fetch('/api/screens/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(screen),
    });
  } catch (err) {
    console.warn('Error syncing screen via API:', err);
  }
}

export async function approveScreenFirestore(
  screenId: string,
  name: string,
  groupId: string,
  buildingId: string,
  zone: string
): Promise<void> {
  try {
    await fetch('/api/screens/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenId, name, groupId, buildingId, zone }),
    });
  } catch (err) {
    console.warn('Error approving screen via API:', err);
  }
}

export async function revokeScreenFirestore(screenId: string): Promise<void> {
  try {
    await fetch('/api/screens/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenId }),
    });
  } catch (err) {
    console.warn('Error revoking screen via API:', err);
  }
}

export async function upsertGroupFirestore(group: ScreenGroup): Promise<void> {
  try {
    await fetch('/api/screens/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(group),
    });
  } catch (err) {
    console.warn('Error syncing group via API:', err);
  }
}

export async function deleteGroupFirestore(groupId: string): Promise<void> {
  try {
    await fetch(`/api/screens/groups/${encodeURIComponent(groupId)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Error deleting group via API:', err);
  }
}

export async function deleteScreenFirestore(screenId: string): Promise<void> {
  try {
    await fetch(`/api/screens/devices/${encodeURIComponent(screenId)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Error deleting screen via API:', err);
  }
}

export async function publishConfigFirestore(
  affectedScreens: ScreenDevice[],
  config: any,
  historyItem: PublishHistoryItem
): Promise<void> {
  try {
    await fetch('/api/screens/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetType: 'all',
        config,
        title: historyItem.targetSummary || 'Đẩy cấu hình',
        publisherEmail: historyItem.publisherEmail,
        publisherName: historyItem.publisherName,
      }),
    });
  } catch (err) {
    console.warn('Error publishing config via API:', err);
  }
}

export async function logHistoryFirestore(item: PublishHistoryItem): Promise<void> {
  try {
    await fetch('/api/history/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: (item.configSnapshot as any)?.title || item.targetSummary || 'Thao tác hệ thống',
        targetSummary: item.targetSummary,
        affectedScreensCount: item.affectedScreensCount,
        publisherEmail: item.publisherEmail,
        publisherName: item.publisherName,
      }),
    });
  } catch (err) {
    console.warn('Error logging history via API:', err);
  }
}

export async function getFirestoreUser(
  usernameOrEmail: string
): Promise<{ email: string; passwordHash: string; role: 'admin' | 'operator'; name: string } | null> {
  try {
    const cleanId = usernameOrEmail.toLowerCase().trim();
    if (cleanId === 'admin' || cleanId.includes('admin')) {
      return { email: cleanId, passwordHash: '', role: 'admin', name: 'Administrator' };
    }
    return { email: cleanId, passwordHash: '', role: 'operator', name: cleanId };
  } catch {
    return null;
  }
}

export async function updateFirestoreUserPassword(
  usernameOrEmail: string,
  newPasswordHash: string,
  role: 'admin' | 'operator',
  name: string
): Promise<void> {
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
  } catch (err) {
    console.warn('Error updating password via API:', err);
  }
}
