const LOG_KEY = 'firestore_debug_logs';
const MAX_LOGS = 100;

export interface FirestoreLog {
  timestamp: string;
  operation: 'read' | 'write' | 'snapshot';
  collection: string;
  docId?: string;
  status: 'success' | 'error';
  message?: string;
}

export function logFirestoreOperation(log: Omit<FirestoreLog, 'timestamp'>) {
  try {
    const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    const newLog: FirestoreLog = {
      ...log,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    if (logs.length > MAX_LOGS) logs.pop();
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to log Firestore operation', e);
  }
}

export function getFirestoreLogs(): FirestoreLog[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export function clearFirestoreLogs() {
  localStorage.removeItem(LOG_KEY);
}
