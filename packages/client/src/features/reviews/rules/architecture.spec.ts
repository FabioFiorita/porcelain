import { describe, expect, it } from 'vitest';
import type { ReviewLayer, Diagram, ReviewResponse } from './review.ts';
import {
  componentRelationships,
  componentNeighborhood,
  layerDiagram,
  reviewUnderstanding,
  reviewCoverage,
} from './architecture.ts';

const step = (
  id: string,
  state: 'current' | 'changed' = 'current',
): ReviewLayer['steps'][number] => ({
  id,
  title: id,
  lane: 0,
  text: 'A decision',
  kind: 'changed',
  pointer: {
    path: 'shared.ts',
    startLine: 1,
    endLine: 3,
    textFingerprint: 'source',
  },
  location:
    state === 'changed' ? { state } : { state, startLine: 1, endLine: 3 },
});
const layer = (
  id: string,
  steps = [step('entry'), step('owner')],
): ReviewLayer => ({
  id,
  title: id,
  summary: 'One behavior',
  lanes: ['Application'],
  steps,
  fingerprint: 'current',
});
const marks = {
  worktreeId: 'worktree',
  marks: [
    {
      layerId: 'invite',
      fingerprint: 'current',
      stale: false,
      reviewedAt: '2026-10-08T00:00:00Z',
    },
    {
      layerId: 'revoke',
      fingerprint: 'before',
      stale: true,
      reviewedAt: '2026-10-08T00:00:00Z',
    },
  ],
};

describe('architectural understanding', () => {
  it('counts independent walkthroughs once even when they touch the same shared file', () => {
    const progress = reviewUnderstanding(
      [layer('invite'), layer('revoke'), layer('export')],
      marks,
    );
    expect([progress.reviewed, progress.remaining, progress.stale]).toEqual([
      1, 2, 0,
    ]);
    expect(
      progress.states.map(({ layer: item, reviewed }) => [item.id, reviewed]),
    ).toEqual([
      ['invite', true],
      ['revoke', false],
      ['export', false],
    ]);
  });
  it('keeps an outdated explanation outstanding even if its current layer fingerprint was marked', () => {
    const progress = reviewUnderstanding(
      [layer('invite', [step('entry', 'changed')])],
      marks,
    );
    expect([progress.reviewed, progress.remaining, progress.stale]).toEqual([
      0, 1, 1,
    ]);
  });
  it('does not treat missing marks as completed work', () => {
    expect(reviewUnderstanding([layer('invite')], undefined).remaining).toBe(1);
  });
});

describe('architectural relationships', () => {
  it('focuses the selected neighborhood while preserving every explicit relationship among its visible components', () => {
    const diagram: Diagram = {
      lanes: ['Unrelated', 'Callers', 'Owners'],
      boxes: [
        { id: 'outside', lane: 0, label: 'Other feature', kind: 'component' },
        { id: 'invite', lane: 1, label: 'Invite', kind: 'component' },
        { id: 'owner', lane: 2, label: 'Policy', kind: 'component' },
      ],
      arrows: [{ from: 'invite', to: 'owner', label: 'authorizes through' }],
    };
    expect(componentNeighborhood(diagram, 'owner')).toEqual({
      lanes: ['Callers', 'Owners'],
      boxes: [
        { id: 'invite', lane: 0, label: 'Invite', kind: 'component' },
        { id: 'owner', lane: 1, label: 'Policy', kind: 'component' },
      ],
      arrows: [{ from: 'invite', to: 'owner', label: 'authorizes through' }],
    });
    expect(componentNeighborhood(diagram, 'missing')).toBe(diagram);
  });
  it('does not invent a call from the order of code pointers', () => {
    expect(layerDiagram(layer('invite')).arrows).toEqual([]);
  });
  it('preserves only explicitly described relationships and keeps prose out of diagram nodes', () => {
    const diagram = layerDiagram({
      ...layer('invite'),
      arrows: [{ from: 'entry', to: 'owner', label: 'calls' }],
    });
    expect(diagram.arrows).toEqual([
      { from: 'entry', to: 'owner', label: 'calls' },
    ]);
    expect(diagram.boxes).toEqual([
      {
        id: 'entry',
        lane: 0,
        label: 'entry',
        kind: 'component',
        change: 'changed',
      },
      {
        id: 'owner',
        lane: 0,
        label: 'owner',
        kind: 'component',
        change: 'changed',
      },
    ]);
  });
  it('lets a shared owner reveal incoming callers and outgoing writes without hiding an unspecified meaning', () => {
    const diagram: Diagram = {
      lanes: ['System'],
      boxes: [
        { id: 'invite', lane: 0, label: 'Invite', kind: 'component' },
        { id: 'owner', lane: 0, label: 'Access owner', kind: 'component' },
        { id: 'store', lane: 0, label: 'Store', kind: 'storage' },
      ],
      arrows: [
        { from: 'invite', to: 'owner', label: 'calls' },
        { from: 'owner', to: 'store' },
        { from: 'missing', to: 'owner', label: 'reads' },
      ],
    };
    expect(
      componentRelationships(diagram, 'owner').map(
        ({ other, outgoing, label }) => [other.label, outgoing, label],
      ),
    ).toEqual([
      ['Invite', false, 'calls'],
      ['Store', true, 'Relationship unspecified'],
    ]);
  });
});

describe('coverage is independent of reading progress', () => {
  const review: Pick<
    ReviewResponse,
    'notExplained' | 'layers' | 'diagnostics'
  > = {
    notExplained: [
      { path: 'shared.ts', ranges: [{ startLine: 40, endLine: 44 }] },
    ],
    layers: [layer('invite', [step('entry', 'changed')])],
    diagnostics: 'current',
  };
  it('keeps an uncovered block visible even when another block in the same file is in a walkthrough', () => {
    expect(reviewCoverage(review)).toEqual({
      gaps: 1,
      stale: 1,
      available: true,
    });
  });
  it('reports unavailable coverage instead of implying that there are no missing changes', () => {
    expect(
      reviewCoverage({
        ...review,
        diagnostics: 'unavailable',
        notExplained: [],
      }).available,
    ).toBe(false);
  });
});
