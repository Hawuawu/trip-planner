import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Runs once per process at module load — Node's module cache guarantees
// this file's body only executes the first time it's required, so this
// never double-initializes even though multiple functions import it.
initializeApp();

export function getDb() {
  return getFirestore();
}

export function getAdminAuth() {
  return getAuth();
}
