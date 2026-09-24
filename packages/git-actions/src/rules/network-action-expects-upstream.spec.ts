import { describe, expect, it } from 'vitest';
import { networkActionExpectsUpstream } from './network-action-expects-upstream.ts';

const remote = { remoteName: 'origin', sourceRef: 'refs/heads/main' };

describe('networkActionExpectsUpstream', () => {
  it.each([
    { action: 'fetch' as const, ...remote },
    { action: 'pull' as const, ...remote },
    {
      action: 'push' as const,
      remoteName: 'origin',
      destinationRef: 'refs/heads/main',
      allowCreate: false,
    },
  ])('refuses a $action that does not state the upstream', (intent) => {
    expect(networkActionExpectsUpstream(intent, {})).toBe(false);
  });

  it('accepts an upstream the client saw at a commit', () => {
    expect(
      networkActionExpectsUpstream(
        { action: 'fetch', ...remote },
        { upstream: { oid: 'e'.repeat(40) } },
      ),
    ).toBe(true);
  });

  it('accepts an upstream the client saw as not existing yet', () => {
    expect(
      networkActionExpectsUpstream(
        {
          action: 'push',
          remoteName: 'origin',
          destinationRef: 'refs/heads/new',
          allowCreate: true,
        },
        { upstream: {} },
      ),
    ).toBe(true);
  });

  it('leaves local actions alone', () => {
    expect(
      networkActionExpectsUpstream(
        { action: 'create-branch', branch: 'feature', switchTo: false },
        {},
      ),
    ).toBe(true);
  });
});
