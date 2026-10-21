import { describe, expect, it } from 'vitest';
import { verdictSections, type ReviewRevision } from './verdict.ts';

const revision: ReviewRevision = {
  reviewId: 'review',
  projectId: 'project',
  revision: 2,
  branch: 'feature',
  base: 'main',
  headOid: 'abcdef123456789',
  baseOid: 'base',
  mergeBaseOid: 'base',
  publishedAt: '2026-10-19T12:00:00Z',
  worktreePath: '/gone',
  worktreeName: 'gone',
  files: [
    { path: 'old.ts', status: 'deleted', oldMode: '100644', newMode: '000000' },
    {
      path: 'missed.ts',
      status: 'deleted',
      oldMode: '100644',
      newMode: '000000',
    },
    {
      path: 'kept.ts',
      status: 'modified',
      oldMode: '100644',
      newMode: '100644',
    },
  ],
  verdict: {
    asked: {
      text: 'Retire the old path',
      links: [{ title: 'Brief', url: 'https://example.com/brief' }],
    },
    recommendation: 'hold',
    reasons: ['A decision is still needed'],
    notProven: [{ what: 'Desktop', why: 'Mac is off' }],
    removed: [
      {
        behavior: 'Old path',
        why: 'Replaced by the owner',
        paths: ['old.ts', 'kept.ts'],
      },
    ],
  },
  content: {
    environmentId: 'environment',
    worktreeId: 'worktree',
    revision: 2,
    publishedAt: '2026-10-19T12:00:00Z',
    active: true,
    diagnostics: 'current',
    summary: {
      byteLength: 10,
      token: 'summary',
      expires: 'expires',
      signature: 'signature',
    },
    layers: [
      {
        id: 'first',
        title: 'One shared owner',
        summary: 'Move every caller',
        lanes: ['Client'],
        fingerprint: 'fingerprint',
        steps: [],
      },
    ],
    notExplained: [],
    proof: {
      current: true,
      checks: [
        { name: 'Unit', result: 'pass' },
        { name: 'Browser', result: 'fail', output: 'The action failed' },
      ],
      assets: [
        {
          id: 'link',
          kind: 'link',
          title: 'Run',
          url: 'https://example.com/run',
        },
      ],
    },
  },
};

describe('verdict sections', () => {
  it('identifies the immutable revision, preserves the brief and reasons, and puts failed proof first', () => {
    const result = verdictSections(revision);
    expect(result.header).toEqual({
      branch: 'feature',
      base: 'main',
      headOid: 'abcdef123456789',
      shortHead: 'abcdef1',
      revision: 2,
    });
    expect(result.asked).toEqual({
      text: 'Retire the old path',
      links: [{ title: 'Brief', url: 'https://example.com/brief' }],
    });
    expect(result.recommendation).toEqual({
      value: 'hold',
      label: 'Hold',
      reasons: ['A decision is still needed'],
    });
    expect(result.proven).toEqual({
      headOid: 'abcdef123456789',
      shortHead: 'abcdef1',
      checks: [
        { name: 'Browser', result: 'fail', output: 'The action failed' },
        { name: 'Unit', result: 'pass' },
      ],
      assets: [
        {
          id: 'link',
          kind: 'link',
          title: 'Run',
          url: 'https://example.com/run',
        },
      ],
    });
    expect(result.notProven).toEqual([{ what: 'Desktop', why: 'Mac is off' }]);
    expect(result.startHere).toEqual({
      layerId: 'first',
      title: 'One shared owner',
    });
  });

  it('lists every Git deletion, including an unexplained deletion, without claiming modified files were deleted', () => {
    expect(verdictSections(revision).removed).toEqual({
      fileCount: 2,
      groups: [
        {
          behavior: 'Old path',
          why: 'Replaced by the owner',
          paths: ['old.ts'],
        },
      ],
      unexplainedPaths: ['missed.ts'],
    });
    expect(revision.verdict.removed[0]?.paths).toEqual(['old.ts', 'kept.ts']);
  });
});
