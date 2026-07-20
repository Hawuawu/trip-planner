import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { resetStores } from './helpers';
import type { AuthService } from '../data/AuthService';

function makeMockAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    getCurrentUser: vi.fn().mockReturnValue(null),
    onAuthStateChanged: vi.fn(),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    refreshAccess: vi.fn().mockResolvedValue(null),
    approveAccess: vi.fn().mockResolvedValue(undefined),
    denyAccess: vi.fn().mockResolvedValue(undefined),
    revokeAccess: vi.fn().mockResolvedValue(undefined),
    subscribeToAllowedUsers: vi.fn().mockReturnValue(() => {}),
    subscribeToAccessRequests: vi.fn().mockReturnValue(() => {}),
    subscribeToAppActivity: vi.fn().mockReturnValue(() => {}),
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

describe('authStore — sign-in error handling', () => {
  it('sets authError with the extracted message when sign-in is rejected', async () => {
    const err = Object.assign(
      new Error('Firebase: This app is invite-only. (auth/internal-error).'),
      {
        code: 'auth/internal-error',
      }
    );
    const service = makeMockAuthService({ signInWithGoogle: vi.fn().mockRejectedValue(err) });
    useAuthStore.getState().init(service);

    await useAuthStore.getState().signInWithGoogle();
    expect(useAuthStore.getState().authError).toBe('This app is invite-only.');
  });

  it('leaves authError null when the user just closed the popup', async () => {
    const err = Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), {
      code: 'auth/popup-closed-by-user',
    });
    const service = makeMockAuthService({ signInWithGoogle: vi.fn().mockRejectedValue(err) });
    useAuthStore.getState().init(service);

    await useAuthStore.getState().signInWithGoogle();
    expect(useAuthStore.getState().authError).toBeNull();
  });

  it('clears a previous authError on retry and on clearAuthError', async () => {
    useAuthStore.setState({ authError: 'old error' });
    const service = makeMockAuthService();
    useAuthStore.getState().init(service);
    await useAuthStore.getState().signInWithGoogle();
    expect(useAuthStore.getState().authError).toBeNull();

    useAuthStore.setState({ authError: 'old error' });
    useAuthStore.getState().clearAuthError();
    expect(useAuthStore.getState().authError).toBeNull();
  });
});

describe('authStore — app access actions', () => {
  it('delegates approveAccess/denyAccess/revokeAccess to the service', async () => {
    const service = makeMockAuthService();
    useAuthStore.getState().init(service);

    await useAuthStore.getState().approveAccess('friend@example.com');
    await useAuthStore.getState().denyAccess('stranger@example.com');
    await useAuthStore.getState().revokeAccess('friend@example.com');

    expect(service.approveAccess).toHaveBeenCalledWith('friend@example.com');
    expect(service.denyAccess).toHaveBeenCalledWith('stranger@example.com');
    expect(service.revokeAccess).toHaveBeenCalledWith('friend@example.com');
  });

  it('refreshAccess updates the stored user with the refreshed claims', async () => {
    const refreshed = {
      uid: 'u1',
      email: 'a@b.com',
      displayName: 'A',
      appAccess: true,
    };
    const service = makeMockAuthService({
      refreshAccess: vi.fn().mockResolvedValue(refreshed),
    });
    useAuthStore.getState().init(service);

    await useAuthStore.getState().refreshAccess();
    expect(useAuthStore.getState().user).toEqual(refreshed);
  });

  it('refreshAccess leaves the user untouched when the service returns null', async () => {
    const service = makeMockAuthService();
    useAuthStore.getState().init(service);
    useAuthStore.setState({ user: { uid: 'u1', email: null, displayName: null } });

    await useAuthStore.getState().refreshAccess();
    expect(useAuthStore.getState().user).toEqual({ uid: 'u1', email: null, displayName: null });
  });

  it('rethrows service failures for the caller to display', async () => {
    const service = makeMockAuthService({
      revokeAccess: vi.fn().mockRejectedValue(new Error('nope')),
    });
    useAuthStore.getState().init(service);
    await expect(useAuthStore.getState().revokeAccess('x@example.com')).rejects.toThrow('nope');
  });

  it('throws when there is no service (local mode)', async () => {
    await expect(useAuthStore.getState().approveAccess('x@example.com')).rejects.toThrow(
      /local mode/
    );
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
