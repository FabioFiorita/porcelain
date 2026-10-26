import { describe, expect, it } from 'vitest';
import { parentFolder } from './parent-folder.ts';

describe('parentFolder', () => {
  it('answers the current folder for a relative name without a parent', () => {
    expect(parentFolder('api')).toBe('.');
  });
});
