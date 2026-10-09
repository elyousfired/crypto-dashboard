import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  type Firestore,
} from 'firebase/firestore';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const FIREBASE_CONFIG_STORAGE_KEY = 'apex_firebase_custom_config_v1';

// Default / saved config from localStorage or env
export const getStoredFirebaseConfig = (): FirebaseConfig | null => {
  try {
    const saved = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to load saved Firebase config:', e);
  }
  return null;
};

export const saveFirebaseConfig = (config: FirebaseConfig) => {
  localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
};

export const clearFirebaseConfig = () => {
  localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export const initFirebase = (customConfig?: FirebaseConfig): boolean => {
  const cfg = customConfig || getStoredFirebaseConfig();
  if (!cfg || !cfg.apiKey || !cfg.projectId) {
    return false;
  }

  try {
    if (!getApps().length) {
      app = initializeApp(cfg);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
    return true;
  } catch (err) {
    console.error('Error initializing Firebase:', err);
    return false;
  }
};

// Auto-init on load if config exists
initFirebase();

export const loginWithGoogle = async (): Promise<User | null> => {
  if (!auth) {
    throw new Error('Firebase non configuré. Veuillez entrer votre configuration Firebase.');
  }
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  return res.user;
};

export const logoutGoogle = async (): Promise<void> => {
  if (auth) {
    await signOut(auth);
  }
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

export const savePortfolioToCloud = async (userId: string, data: any): Promise<boolean> => {
  if (!db) return false;
  try {
    const userDocRef = doc(db, 'users', userId, 'portfolio', 'active');
    await setDoc(userDocRef, {
      ...data,
      updatedAt: Date.now(),
    });
    return true;
  } catch (err) {
    console.error('Failed to save to Firestore:', err);
    return false;
  }
};

export const loadPortfolioFromCloud = async (userId: string): Promise<any | null> => {
  if (!db) return null;
  try {
    const userDocRef = doc(db, 'users', userId, 'portfolio', 'active');
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.error('Failed to load from Firestore:', err);
  }
  return null;
};

export const subscribeToCloudPortfolio = (userId: string, onUpdate: (data: any) => void) => {
  if (!db) return () => {};
  const userDocRef = doc(db, 'users', userId, 'portfolio', 'active');
  return onSnapshot(userDocRef, (snap) => {
    if (snap.exists()) {
      onUpdate(snap.data());
    }
  });
};
