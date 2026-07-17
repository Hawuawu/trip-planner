import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { resetStores } from './helpers';
import type { AuthService } from '../data/AuthService';

function makeMockAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    onAuthStateChanged: vi.fn(),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  resetStores();
});

describe('authStore — init', () => {
  it('stores the service reference and calls onAuthStateChanged', () => {
    const service = makeMockAuthService();
    useAuthStore.getState().init(service);
    expect(useAuthStore.getState().service).toBe(service);
    expect(service.onAuthStateChanged).toHaveBeenCalledTimes(1);
  });

  it('sets user and loading=false when onAuthStateChanged callback fires', () => {
    const service = makeMockAuthService({
      onAuthStateChanged: vi.fn((cb) => {
        cb({ uid: 'u1', email: 'test@example.com', displayName: 'Test User' });
      }),
    });
    useAuthStore.getState().init(service);
    const state = useAuthStore.getState();
    expect(state.user).toEqual({ uid: 'u1', email: 'test@example.com', displayName: 'Test User' });
    expect(state.loading).toBe(false);
  });

  it('sets user=null and loading=false when auth callback fires with null', () => {
    const service = makeMockAuthService({
      onAuthStateChanged: vi.fn((cb) => {
        cb(null);
      }),
    });
    useAuthStore.getState().init(service);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().loading).toBe(false);
  });
});

describe('authStore — signInWithGoogle', () => {
  it('calls service.signInWithGoogle', async () => {
    const service = makeMockAuthService();
    useAuthStore.getState().init(service);
    await useAuthStore.getState().signInWithGoogle();
    expect(service.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('does nothing when service is null', async () => {
    // service is null by default (resetStores sets it to null)
    await expect(useAuthStore.getState().signInWithGoogle()).resolves.toBeUndefined();
  });
});

describe('authStore — signOut', () => {
  it('calls service.signOut', async () => {
    const service = makeMockAuthService();
    useAuthStore.getState().init(service);
    await useAuthStore.getState().signOut();
    expect(service.signOut).toHaveBeenCalledTimes(1);
  });

  it('does nothing when service is null', async () => {
    await expect(useAuthStore.getState().signOut()).resolves.toBeUndefined();
  });
});
