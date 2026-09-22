import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, type Analytics } from 'firebase/analytics';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env
    .VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as
    | string
    | undefined,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

/** Stub config so the app boots before .env.local is filled in */
const app: FirebaseApp = initializeApp(
  isFirebaseConfigured
    ? firebaseConfig
    : {
        apiKey: 'unconfigured',
        authDomain: 'localhost',
        projectId: 'unconfigured',
        storageBucket: 'unconfigured',
        messagingSenderId: '0',
        appId: 'unconfigured',
      },
);

export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

export const analytics: Analytics | null =
  typeof window !== 'undefined' &&
  isFirebaseConfigured &&
  firebaseConfig.measurementId
    ? getAnalytics(app)
    : null;

export default app;
