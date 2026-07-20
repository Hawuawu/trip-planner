import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function ensureApp() {
  if (!getApps().length) initializeApp();
}

export function getDb() {
  ensureApp();
  return getFirestore();
}

export function getAdminAuth() {
  ensureApp();
  return getAuth();
}
