import { describe, it, expect } from 'vitest';
import { LocalTripRepository } from '../data/localTripRepository';

describe('LocalTripRepository', () => {
  it('resolves getTrip with the correct id', async () => {
    const repo = new LocalTripRepository();
    const trip = await repo.getTrip('demo');
    expect(trip.id).toBe('demo');
  });
});
