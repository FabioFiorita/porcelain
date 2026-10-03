import { describe, expect, it } from 'vitest';
import { repositoryMoved } from './repository-moved.ts';

describe('repositoryMoved', () => {
  it('says a folder that now holds another repository has moved', () => {
    expect(
      repositoryMoved(
        { repositoryIdentity: 'registered' },
        { repositoryIdentity: 'another' },
      ),
    ).toBe(true);
  });

  it('keeps a folder that still holds the registered repository', () => {
    expect(
      repositoryMoved(
        { repositoryIdentity: 'registered' },
        { repositoryIdentity: 'registered' },
      ),
    ).toBe(false);
  });
});
