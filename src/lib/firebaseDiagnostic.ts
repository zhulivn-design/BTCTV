import firebaseConfigData from '../../firebase-applet-config.json';
import { db, collection, getDocs } from './firebase';

export interface FirebaseDiagnosticResult {
  clientConfig: {
    projectId: string;
    databaseId: string;
    authDomain: string;
    storageBucket: string;
    appId: string;
    messagingSenderId: string;
    apiKeyMasked: string;
  };
  serverConfig?: {
    projectId: string;
    databaseId: string;
    authDomain: string;
    storageBucket: string;
    appId: string;
    messagingSenderId: string;
    apiKeyMasked: string;
  };
  isMatching: boolean;
  clientFirestoreTest: {
    success: boolean;
    groupDocsCount?: number;
    error?: string;
  };
  serverFirestoreTest?: {
    usersCount?: number;
    groupsCount?: number;
  };
  timestamp: string;
}

export async function runFirebaseDiagnostics(): Promise<FirebaseDiagnosticResult> {
  const clientConfig = {
    projectId: firebaseConfigData.projectId || 'N/A',
    databaseId: firebaseConfigData.firestoreDatabaseId || '(default)',
    authDomain: firebaseConfigData.authDomain || 'N/A',
    storageBucket: firebaseConfigData.storageBucket || 'N/A',
    appId: firebaseConfigData.appId || 'N/A',
    messagingSenderId: firebaseConfigData.messagingSenderId || 'N/A',
    apiKeyMasked: firebaseConfigData.apiKey
      ? `${firebaseConfigData.apiKey.substring(0, 8)}...${firebaseConfigData.apiKey.substring(firebaseConfigData.apiKey.length - 6)}`
      : 'N/A',
  };

  // 1. Direct Client Firestore Ping
  let clientFirestoreTest: FirebaseDiagnosticResult['clientFirestoreTest'] = { success: false };
  try {
    const snap = await getDocs(collection(db, 'groups'));
    clientFirestoreTest = {
      success: true,
      groupDocsCount: snap.size,
    };
  } catch (err: any) {
    clientFirestoreTest = {
      success: false,
      error: err?.message || String(err),
    };
  }

  // 2. Fetch Server Firebase Config
  let serverConfig: FirebaseDiagnosticResult['serverConfig'] = undefined;
  let serverFirestoreTest: FirebaseDiagnosticResult['serverFirestoreTest'] = undefined;
  try {
    const res = await fetch('/api/firebase/info').catch(() => null);
    if (res && res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => null);
        if (data && data.config) {
          serverConfig = data.config;
        }
      }
    }

    const statusRes = await fetch('/api/debug/system-status').catch(() => null);
    if (statusRes && statusRes.ok) {
      const statusContentType = statusRes.headers.get('content-type') || '';
      if (statusContentType.includes('application/json')) {
        const statusData = await statusRes.json().catch(() => null);
        if (statusData && statusData.firestoreDB) {
          serverFirestoreTest = {
            usersCount: statusData.firestoreDB.usersCount,
            groupsCount: statusData.firestoreDB.groupsCount,
          };
        }
      }
    }
  } catch {
    // Silently continue if server diagnostic endpoints are unavailable on static hosting
  }

  const isServerConnected = Boolean(serverConfig);
  const isMatching = serverConfig
    ? serverConfig.projectId === clientConfig.projectId &&
      serverConfig.databaseId === clientConfig.databaseId
    : true;

  const timestamp = new Date().toISOString();

  // 3. Formatted Console Logging Output
  console.group('%c🔥 FIREBASE DIAGNOSTIC REPORT', 'color: #38bdf8; font-weight: bold; font-size: 14px; background: #0f172a; padding: 6px 12px; border-radius: 6px;');
  console.log('%cTimestamp:', 'color: #94a3b8; font-weight: bold;', timestamp);
  console.log('%cHost URL:', 'color: #94a3b8; font-weight: bold;', window.location.href);

  console.table({
    'Project ID': clientConfig.projectId,
    'Database ID (Firestore)': clientConfig.databaseId,
    'Auth Domain': clientConfig.authDomain,
    'Storage Bucket': clientConfig.storageBucket,
    'App ID': clientConfig.appId,
    'Messaging Sender ID': clientConfig.messagingSenderId,
    'API Key (Masked)': clientConfig.apiKeyMasked,
  });

  if (serverConfig) {
    if (isMatching) {
      console.log(
        '%c✅ MATCH: Client & Server are both connected to the EXACT same Firestore database instance!',
        'color: #4ade80; font-weight: bold; font-size: 12px; background: #064e3b; padding: 4px 8px; border-radius: 4px;'
      );
    } else {
      console.warn(
        '%c⚠️ MISMATCH DETECTED between Client and Server database configs!',
        'color: #f87171; font-weight: bold; font-size: 12px; background: #7f1d1d; padding: 4px 8px; border-radius: 4px;',
        { clientConfig, serverConfig }
      );
    }
  }

  if (clientFirestoreTest.success) {
    console.log(
      `%c✅ Client Direct Firestore Query Success: Found ${clientFirestoreTest.groupDocsCount} group documents in collection "groups".`,
      'color: #38bdf8;'
    );
  } else {
    console.error(
      `%c❌ Client Direct Firestore Query Failed: ${clientFirestoreTest.error}`,
      'color: #f87171;'
    );
  }

  console.log(
    '%c💡 Tip: Type `logFirebaseInfo()` or `runFirebaseDiagnostics()` anytime in this console to rerun diagnostics.',
    'color: #cbd5e1; font-style: italic;'
  );
  console.groupEnd();

  return {
    clientConfig,
    serverConfig,
    isMatching,
    clientFirestoreTest,
    serverFirestoreTest,
    timestamp,
  };
}

// Auto-bind to window object on client load
if (typeof window !== 'undefined') {
  (window as any).logFirebaseInfo = runFirebaseDiagnostics;
  (window as any).runFirebaseDiagnostics = runFirebaseDiagnostics;
  (window as any).firebaseConfigData = firebaseConfigData;

  // Auto run once on startup
  setTimeout(() => {
    runFirebaseDiagnostics().catch(() => {});
  }, 1000);
}
