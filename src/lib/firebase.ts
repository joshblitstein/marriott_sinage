import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, type Analytics } from 'firebase/analytics';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

/**
 * Firebase web client config is public (security is Firestore rules + auth).
 * Env vars override these defaults when set (local .env.local / Vercel).
 */
const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    'AIzaSyApVfspNTSOt00jqGiGbF2sjmgFe6jGPEs',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    'marriot-project.firebaseapp.com',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || 'marriot-project',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'marriot-project.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '89222812197',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:89222812197:web:91d18b7c8cd0847a4f65cc',
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-REZVEBE3R3',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    firebaseConfig.apiKey !== 'unconfigured',
);

const app: FirebaseApp = initializeApp(firebaseConfig);

export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

export const analytics: Analytics | null =
  typeof window !== 'undefined' && firebaseConfig.measurementId
    ? getAnalytics(app)
    : null;

export default app;
