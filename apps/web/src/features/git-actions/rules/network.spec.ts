import { describe, expect, it } from 'vitest';
import { networkInput, networkTarget } from './network.ts';

const displayed = { name: 'main', upstream: 'origin/main' };
const looked = { branch: { name: 'main', upstream: 'origin/main' } };

describe('networkTarget', () => {
  it('refuses while the branch target has not been read yet', () => {
    expect(networkTarget(undefined, displayed, true)).toEqual({
      ready: false,
      reason: 'The branch target is still loading. Try again.',
    });
  });

  it('refuses a freshly read target whose branch name differs from the one shown', () => {
    expect(
      networkTarget(
        { branch: { name: 'feature', upstream: 'origin/main' } },
        displayed,
        true,
      ),
    ).toEqual({
      ready: false,
      reason: 'The branch target changed. Review it and try again.',
    });
  });

  it('refuses a freshly read target whose upstream differs from the one shown', () => {
    expect(
      networkTarget(
        { branch: { name: 'main', upstream: 'fork/main' } },
        displayed,
        true,
      ),
    ).toEqual({
      ready: false,
      reason: 'The branch target changed. Review it and try again.',
    });
  });

  it('accepts a freshly read target that matches the branch shown', () => {
    expect(networkTarget(looked, displayed, true)).toEqual({
      ready: true,
      looked,
    });
  });
});

describe('networkInput', () => {
  const branch = {
    name: 'refs/heads/main',
    upstream: 'origin/main',
    ahead: 1,
    behind: 0,
    remoteName: 'origin',
    sourceRef: 'refs/heads/main',
    upstreamOid: undefined,
    stashes: [],
    discarded: [],
  };

  it('pulls from the configured upstream with the chosen strategy', () => {
    expect(networkInput('pull', branch, 'rebase')).toEqual({
      action: 'pull',
      remoteName: 'origin',
      sourceRef: 'refs/heads/main',
      strategy: 'rebase',
    });
  });

  it('refuses to fetch or pull when no upstream is configured', () => {
    const detached = { ...branch, upstream: undefined };
    expect(() => networkInput('fetch', detached, 'merge')).toThrow(
      'Configure an upstream branch first.',
    );
    expect(() => networkInput('pull', detached, 'merge')).toThrow(
      'Configure an upstream branch first.',
    );
  });

  it('refuses to fetch or pull when the upstream no longer matches its remote and ref', () => {
    const moved = { ...branch, upstream: 'fork/main' };
    expect(() => networkInput('fetch', moved, 'merge')).toThrow(
      'The configured upstream changed. Review it and try again.',
    );
    expect(() => networkInput('pull', moved, 'merge')).toThrow(
      'The configured upstream changed. Review it and try again.',
    );
  });

  it('pushes to origin and creates the remote branch only when no upstream exists', () => {
    expect(
      networkInput(
        'push',
        {
          ...branch,
          name: 'refs/heads/topic',
          upstream: undefined,
          remoteName: undefined,
          sourceRef: undefined,
        },
        'merge',
      ),
    ).toEqual({
      action: 'push',
      remoteName: 'origin',
      destinationRef: 'refs/heads/topic',
      allowCreate: true,
    });
  });
});
