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
  measurementId?: string;
}

// User's project config
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: "AIzaSyDe-x34BXjRS5mlyi3fDdQzYUkWPg4AoN8",
  authDomain: "apex-portfolio-43b6f.firebaseapp.com",
  projectId: "apex-portfolio-43b6f",
  storageBucket: "apex-portfolio-43b6f.firebasestorage.app",
  messagingSenderId: "289401615239",
  appId: "1:289401615239:web:a6a84b134ba54f28a3d922",
  measurementId: "G-4RNK1RM8KG",
};

const FIREBASE_CONFIG_STORAGE_KEY = 'apex_firebase_custom_config_v1';

export const getStoredFirebaseConfig = (): FirebaseConfig => {
  try {
    const saved = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to load saved Firebase config:', e);
  }
  return DEFAULT_FIREBASE_CONFIG;
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

// Auto-init on load
initFirebase();

export const loginWithGoogle = async (): Promise<User | null> => {
  if (!auth) {
    initFirebase();
  }
  if (!auth) {
    throw new Error('Erreur d initialisation Firebase.');
  }

  const provider = new GoogleAuthProvider();
  try {
    const res = await signInWithPopup(auth, provider);
    return res.user;
  } catch (err: any) {
    if (err.code === 'auth/unauthorized-domain') {
      const hostname = window.location.hostname;
      throw new Error(
        `Le domaine ${hostname} doit être ajouté dans Firebase Console > Authentication > Settings > Domaines autorisés.`
      );
    }
    if (err.code === 'auth/configuration-not-found') {
      throw new Error(
        'Veuillez activer la méthode de connexion "Google" dans Firebase Console > Authentication > Mode de connexion.'
      );
    }
    throw err;
  }
};

export const logoutGoogle = async (): Promise<void> => {
  if (auth) {
    await signOut(auth);
  }
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  if (!auth) {
    initFirebase();
  }
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
