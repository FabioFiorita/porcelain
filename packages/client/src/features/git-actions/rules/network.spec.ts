import { expectationFor } from './feedback.ts';
import { describe, expect, it } from 'vitest';
import { networkInput, networkTarget, networkNotice } from './network.ts';

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
    name: 'main',
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
          name: 'topic',
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

it.each([
  ['topic/nested', 'refs/heads/topic/nested'],
  ['refs/heads/topic', 'refs/heads/refs/heads/topic'],
  ['refs/tags/release', 'refs/heads/refs/tags/release'],
] as const)(
  'keeps branch %s in expectations and full push targets',
  (name, destinationRef) => {
    const branch = {
      name,
      upstream: undefined,
      ahead: 1,
      behind: 0,
      remoteName: undefined,
      sourceRef: undefined,
      upstreamOid: undefined,
      stashes: [],
      discarded: [],
    };
    expect(
      expectationFor({ statusToken: 'token', changes: [], branch }).branch,
    ).toBe(name);
    expect(networkInput('push', branch, 'merge')).toEqual({
      action: 'push',
      remoteName: 'origin',
      destinationRef,
      allowCreate: true,
    });
  },
);

it.each([
  ['interrupted', 'Pull outcome not confirmed', 'error'],
  ['conflicted', 'Pull needs conflict resolution', 'error'],
  ['rejected', 'Pull did not run', 'error'],
  ['running', 'Pull in progress', 'info'],
  ['succeeded', 'Pull', 'success'],
  ['no-change', 'Pull', 'success'],
] as const)(
  'describes a %s receipt without denying possible effects',
  (state, title, type) => {
    expect(
      networkNotice('pull', {
        projectId: '11111111-1111-4111-8111-111111111111',
        worktreeId: '0123456789abcdef0123456789abcdef',
        requestId: '22222222-2222-4222-8222-222222222222',
        action: 'pull',
        state,
        acceptedAt: '2026-11-01T00:00:00.000Z',
        progress: [],
        message: 'Inspect the current branch.',
      }),
    ).toEqual({ title, description: 'Inspect the current branch.', type });
  },
);
