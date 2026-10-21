import { describe, expect, it } from 'vitest';
import { instantAfter } from './instant-after.ts';

describe('instantAfter', () => {
  it('moves a cutoff before its starting instant across the previous year', () => {
    expect(instantAfter('2026-01-01T00:00:00.000Z', -1)).toBe(
      '2025-12-31T23:59:59.999Z',
    );
  });
});
