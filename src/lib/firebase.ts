import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, setDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp, setLogLevel } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

try {
  setLogLevel('silent');
} catch {
  // ignore
}

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
  databaseId: firebaseConfigData.firestoreDatabaseId || '(default)'
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app, firebaseConfigData.firestoreDatabaseId || '(default)');

export {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp
};
