// Run with: npm run test:firebase (requires Firebase emulators)
//
// Security-rules regression tests for the app-invite-gate collections (#35):
// allowedUsers, invites, and appActivityLog. These are admin-read-only from
// the client; every mutation happens through the Admin SDK inside Cloud
// Functions, so ALL direct writes must be denied — even the admin's.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ADMIN_EMAIL } from '../config/admin';

// Deliberately NOT the shared 'demo-trip-planner-test' project id: vitest runs
// test files in parallel, and clearFirestore() wipes the entire project — with
// a shared id, this file's afterEach would race the other firebase test file
// and delete its seeded docs mid-test. A distinct id isolates the two suites
// inside the one emulator.
const PROJECT_ID = 'demo-trip-planner-allowlist-test';
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

const COLLECTIONS = ['allowedUsers', 'invites', 'appActivityLog'] as const;

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

const admin = () => testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL }).firestore();
const member = () =>
  testEnv.authenticatedContext('member-uid', { email: 'someone@example.com' }).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

async function seedDoc(collection: (typeof COLLECTIONS)[number]): Promise<string> {
  const id = `${collection}-doc`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection(collection).doc(id).set({ seeded: true });
  });
  return id;
}

describe.each(COLLECTIONS)('%s rules', (collection) => {
  it('lets the admin read (get and list)', async () => {
    const id = await seedDoc(collection);
    await assertSucceeds(admin().collection(collection).doc(id).get());
    await assertSucceeds(admin().collection(collection).get());
  });

  it('matches the admin email case-insensitively', async () => {
    const id = await seedDoc(collection);
    const shoutyAdmin = testEnv
      .authenticatedContext('admin-uid', { email: ADMIN_EMAIL.toUpperCase() })
      .firestore();
    await assertSucceeds(shoutyAdmin.collection(collection).doc(id).get());
  });

  it('denies reads for a non-admin authenticated user and for unauthenticated', async () => {
    const id = await seedDoc(collection);
    await assertFails(member().collection(collection).doc(id).get());
    await assertFails(member().collection(collection).get());
    await assertFails(anon().collection(collection).doc(id).get());
  });

  it('denies all direct writes, including from the admin', async () => {
    const id = await seedDoc(collection);
    await assertFails(admin().collection(collection).doc('new-doc').set({ sneaky: true }));
    await assertFails(admin().collection(collection).doc(id).update({ sneaky: true }));
    await assertFails(admin().collection(collection).doc(id).delete());
    await assertFails(member().collection(collection).doc('new-doc').set({ sneaky: true }));
  });
});
