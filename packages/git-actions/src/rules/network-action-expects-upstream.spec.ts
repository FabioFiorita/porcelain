import { MissingUpstreamExpectationError } from '@porcelain/git-actions/errors';
import { describe, expect, it } from 'vitest';
import { networkActionExpectsUpstream } from './network-action-expects-upstream.ts';

const remote = { remoteName: 'origin', sourceRef: 'refs/heads/main' };

describe('networkActionExpectsUpstream', () => {
  it('refuses fetch, pull and push that do not state the upstream', () => {
    for (const intent of [
      { action: 'fetch' as const, ...remote },
      { action: 'pull' as const, ...remote },
      {
        action: 'push' as const,
        remoteName: 'origin',
        destinationRef: 'refs/heads/main',
        allowCreate: false,
      },
    ])
      expect(() => networkActionExpectsUpstream(intent, {})).toThrow(
        MissingUpstreamExpectationError,
      );
  });

  it('accepts an upstream the client saw at a commit', () => {
    expect(() =>
      networkActionExpectsUpstream(
        { action: 'fetch', ...remote },
        { upstream: { oid: 'e'.repeat(40) } },
      ),
    ).not.toThrow();
  });

  it('accepts an upstream the client saw as not existing yet', () => {
    expect(() =>
      networkActionExpectsUpstream(
        {
          action: 'push',
          remoteName: 'origin',
          destinationRef: 'refs/heads/new',
          allowCreate: true,
        },
        { upstream: {} },
      ),
    ).not.toThrow();
  });

  it('leaves local actions alone', () => {
    expect(() =>
      networkActionExpectsUpstream(
        { action: 'create-branch', branch: 'feature', switchTo: false },
        {},
      ),
    ).not.toThrow();
  });
});
