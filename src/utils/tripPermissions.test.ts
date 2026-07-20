import { describe, it, expect } from 'vitest';
import { canManage } from './tripPermissions';
import type { Trip } from '../types';

const BASE: Trip = {
  id: 'trip-1',
  name: 'Japan 2026',
  dateRange: { start: '2026-10-01', end: '2026-10-14' },
  memberIds: ['owner-uid', 'member-uid'],
};

describe('canManage', () => {
  it('returns true for the owner', () => {
    expect(canManage({ ...BASE, ownerId: 'owner-uid' }, 'owner-uid')).toBe(true);
  });

  it('returns false for a non-owner member', () => {
    expect(canManage({ ...BASE, ownerId: 'owner-uid' }, 'member-uid')).toBe(false);
  });

  it('returns true for anyone on a legacy trip with no ownerId', () => {
    expect(canManage(BASE, 'member-uid')).toBe(true);
  });

  it('returns false for an undefined uid on an owned trip', () => {
    expect(canManage({ ...BASE, ownerId: 'owner-uid' }, undefined)).toBe(false);
  });
});
