import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import firebaseConfig from '../firebase-applet-config.json';

/**
 * Firebase 設定：
 * 優先使用 firebase-applet-config.json 作為單一事實來源。
 * 啟用離線持久化與多頁籤同步，優化跨裝置體驗。
 */
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { logger } from './lib/logger';

const app = initializeApp(firebaseConfig);

/**
 * 初始化 App Check (生產環境建議啟用)
 */
export function initFirebaseAppCheck() {
  if (typeof window === 'undefined') return;

  const siteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY;
  const isProd = import.meta.env.PROD;

  if (siteKey) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
      logger.log('[Firebase] App Check initialized successfully.');
    } catch (err) {
      logger.warn('[Firebase] App Check initialization failed:', err);
    }
  } else {
    const msg = '[Firebase] App Check skipped: VITE_FIREBASE_APP_CHECK_SITE_KEY not found.';
    if (isProd) {
      console.warn(`${msg} CRITICAL: Production environment should enable App Check to prevent abuse.`);
    } else {
      logger.log(msg);
    }
  }
}

// Call initialization
initFirebaseAppCheck();

export const auth = getAuth(app);

// 啟用離線持久化 (Offline Persistence)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);

export const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export { googleProvider, signInWithPopup, signOut };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const isDev = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true';
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Extract minimal info for production
  const sanitizedInfo = {
    error: errorMessage.replace(/\[.*?\]/g, ''), // Strip Firebase internal codes if needed or keep them but hide PII
    operationType,
    path: isDev ? path : 'restricted',
    userId: auth.currentUser?.uid ? 'authenticated' : 'anonymous'
  };

  if (isDev) {
    console.error('[Firestore Error Details]', {
      error,
      operationType,
      path,
      userId: auth.currentUser?.uid,
      errorCode: (error as any)?.code
    });
  } else {
    console.error('[Firestore Error]', sanitizedInfo);
  }

  // Provide a user-friendly message
  let userMessage = '資料庫操作失敗，請稍後再試。';
  if (errorMessage.includes('permission-denied')) {
    userMessage = '您沒有權限執行此操作。';
  } else if (errorMessage.includes('not-found')) {
    userMessage = '找不到指定的資料。';
  }

  throw new Error(userMessage);
}
