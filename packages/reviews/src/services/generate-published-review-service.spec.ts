import { describe, expect, it } from 'vitest';
import type { FileChange, TrackedComparison } from '@porcelain/kernel/models';
import { FixedClock } from '@porcelain/kernel/fakes';
import type {
  Review,
  ReviewDiff,
  ReviewStep,
  ReviewTextRead,
} from '@porcelain/reviews/models';
import { ScriptedSignatureSource } from '../../spec/fakes/scripted-signature-source.ts';
import { GeneratePublishedReviewService } from './generate-published-review-service.ts';

const worktreeId = 'a'.repeat(64);
const environmentId = '6f1c2f4e-7c1b-4b61-9d6e-2f0a4f3a9b10';
const token = '6f1c2f4e-7c1b-4b61-9d6e-2f0a4f3a9b11';

function step(overrides: Partial<ReviewStep> = {}): ReviewStep {
  return {
    id: 'step-1',
    lane: 0,
    title: 'New line',
    text: 'A line is added',
    kind: 'changed',
    pointer: { path: 'README.md', startLine: 3, endLine: 3 },
    published: ['added'],
    ...overrides,
  };
}

function review(steps: ReviewStep[] = [step()]): Review {
  return {
    worktreeId,
    revision: 1,
    publishedAt: '2026-01-01T00:00:00.000Z',
    active: true,
    summaryHtml: '<h1>Résumé</h1>',
    summaryToken: token,
    summarySecret: 'secret',
    layers: [
      {
        id: 'layer-1',
        title: 'Readme',
        summary: 'Adds a line',
        lanes: ['Docs'],
        fingerprint: 'published',
        steps,
      },
    ],
  };
}

function unstaged(path: string, deleted: boolean): TrackedComparison {
  return {
    scope: 'unstaged',
    kind: deleted ? 'deleted' : 'modified',
    oldPath: path,
    newPath: deleted ? undefined : path,
    oldMode: '100644',
    newMode: '100644',
    oldOid: undefined,
    newOid: undefined,
    supported: true,
  };
}

function changed(path: string, deleted = false): FileChange {
  return { path, fingerprint: 'f', comparisons: [unstaged(path, deleted)] };
}

function patch(path: string, text: string): ReviewDiff {
  return {
    selection: { scope: 'unstaged', oldPath: path, newPath: path },
    content: { kind: 'text', patch: text },
  };
}

function text(path: string, content: string): ReviewTextRead {
  return { status: 'fulfilled', value: { path, text: content } };
}

const service = new GeneratePublishedReviewService(
  new FixedClock('2026-01-01T00:00:00.000Z'),
  new ScriptedSignatureSource(),
  { lifetimeMs: 3_600_000 },
);

function generate(evidence: {
  steps?: ReviewStep[];
  changes?: FileChange[];
  texts?: ReviewTextRead[];
  diffs?: ReviewDiff[];
}) {
  return service.execute({
    environmentId,
    review: review(evidence.steps),
    changes: evidence.changes ?? [],
    texts: evidence.texts ?? [],
    diffs: evidence.diffs ?? [],
  });
}

const readme = 'first\nsecond\nadded\n';
const stillChanged = {
  changes: [changed('README.md')],
  texts: [text('README.md', readme)],
  diffs: [patch('README.md', '@@ -2,0 +3 @@\n+added\n')],
};

describe('GeneratePublishedReviewService', () => {
  it('locates a step at its published lines as current while they are still changed', () => {
    const resolved = generate(stillChanged);
    expect(resolved).toMatchObject({
      environmentId,
      worktreeId,
      revision: 1,
      active: true,
      diagnostics: 'current',
      notExplained: [],
    });
    expect(resolved.layers[0]?.steps[0]?.location).toEqual({
      state: 'current',
      startLine: 3,
      endLine: 3,
    });
  });

  it('locates a step as committed once its lines no longer change, and the review goes inactive', () => {
    const resolved = generate({ texts: [text('README.md', readme)] });
    expect(resolved.layers[0]?.steps[0]?.location).toEqual({
      state: 'committed',
      startLine: 3,
      endLine: 3,
    });
    expect(resolved.active).toBe(false);
  });

  it('keeps the review active while it explains nothing that changed', () => {
    expect(
      generate({
        steps: [step({ kind: 'context' })],
        texts: [text('README.md', readme)],
      }).active,
    ).toBe(true);
  });

  it('follows the published lines to where they moved', () => {
    expect(
      generate({ texts: [text('README.md', `zero\n${readme}`)] }).layers[0]
        ?.steps[0]?.location,
    ).toEqual({ state: 'committed', startLine: 4, endLine: 4 });
  });

  it('locates a step as changed when its lines are gone or its file cannot be read', () => {
    const unreadable: ReviewTextRead = {
      status: 'rejected',
      reason: new Error('missing'),
    };
    for (const texts of [[text('README.md', 'first\nsecond\n')], [unreadable]])
      expect(generate({ texts }).layers[0]?.steps[0]?.location).toEqual({
        state: 'changed',
      });
  });

  it('lists changed lines outside the paragraphs the steps explain', () => {
    expect(
      generate({
        changes: [changed('README.md')],
        texts: [text('README.md', 'first\n\nadded\n')],
        diffs: [
          patch('README.md', '@@ -0,0 +1 @@\n+first\n@@ -1,0 +3 @@\n+added\n'),
        ],
      }).notExplained,
    ).toEqual([{ path: 'README.md', ranges: [{ startLine: 1, endLine: 1 }] }]);
  });

  it('lists a deleted file and a binary file as changed without lines', () => {
    expect(
      generate({
        ...stillChanged,
        changes: [
          ...stillChanged.changes,
          changed('gone.txt', true),
          changed('logo.png'),
        ],
        diffs: [
          ...stillChanged.diffs,
          {
            selection: {
              scope: 'unstaged',
              oldPath: 'logo.png',
              newPath: 'logo.png',
            },
            content: { kind: 'binary' },
          },
        ],
      }).notExplained,
    ).toEqual([
      { path: 'gone.txt', ranges: [], deleted: true },
      { path: 'logo.png', ranges: [], binary: true },
    ]);
  });

  it('signs a summary link that expires one lifetime after now', () => {
    const expires = '2026-01-01T01:00:00.000Z';
    const url = new URL(generate(stillChanged).summary.url, 'http://x');
    expect(url.pathname).toBe(`/review-summaries/${token}`);
    expect(url.searchParams.get('expires')).toBe(expires);
    expect(url.searchParams.get('signature')).toBe(
      `secret:${token}\0${expires}`,
    );
  });

  it('measures the summary in UTF-8 bytes', () => {
    expect(generate(stillChanged).summary.byteLength).toBe(17);
  });
});
