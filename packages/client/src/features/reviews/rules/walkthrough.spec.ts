import { describe, expect, it } from 'vitest';
import type { ReviewLayer, ReviewResponse } from './review.ts';
import {
  currentStop,
  decisionLinks,
  decisionRoute,
  decisionStates,
  filesReviewed,
  neighbourStop,
  stopDone,
  systemChanges,
  walkthroughStops,
} from './walkthrough.ts';

const step = (
  path: string,
  options: {
    kind?: 'changed' | 'context';
    lane?: number;
    state?: 'current' | 'changed';
  } = {},
): ReviewLayer['steps'][number] => ({
  id: `${path}:${options.lane ?? 0}`,
  title: path,
  lane: options.lane ?? 0,
  text: 'Why this code exists',
  kind: options.kind ?? 'changed',
  pointer: { path, startLine: 1, endLine: 2, textFingerprint: 'source' },
  location:
    options.state === 'changed'
      ? { state: 'changed' }
      : { state: 'current', startLine: 1, endLine: 2 },
});
const layer = (
  id: string,
  steps: ReviewLayer['steps'],
  lanes = ['Entry', 'Client', 'Server'],
): ReviewLayer => ({
  id,
  title: `Decision ${id}`,
  summary: 'One decision',
  lanes,
  steps,
  fingerprint: `${id}-now`,
});
const gap = (path: string, startLine = 3, endLine = 4) => ({
  path,
  ranges: [{ startLine, endLine }],
});
const keysAndPaths = (
  review: Pick<ReviewResponse, 'layers' | 'notExplained'>,
  changed: string[],
  specsApart = false,
) =>
  walkthroughStops(review, changed, { specsApart }).map((stop) => [
    stop.key,
    stop.paths,
  ]);

describe('walkthrough stops', () => {
  it('places every changed file in exactly one stop, in decision order, with unexplained files after the decisions', () => {
    const review = {
      layers: [
        layer('invite', [step('web/invite.ts'), step('shared/policy.ts')]),
        layer('revoke', [step('shared/policy.ts'), step('web/revoke.ts')]),
      ],
      notExplained: [gap('scripts/migrate.ts', 1, 2)],
    };
    expect(
      keysAndPaths(review, [
        'scripts/migrate.ts',
        'shared/policy.ts',
        'web/invite.ts',
        'web/revoke.ts',
      ]),
    ).toEqual([
      ['briefing', []],
      ['decision:invite', ['web/invite.ts', 'shared/policy.ts']],
      ['decision:revoke', ['web/revoke.ts']],
      ['unexplained', ['scripts/migrate.ts']],
    ]);
  });

  it('points a decision at the earlier decision that already shows a file it shares', () => {
    const [, , revoke] = walkthroughStops(
      {
        layers: [
          layer('invite', [step('shared/policy.ts')]),
          layer('revoke', [step('shared/policy.ts'), step('web/revoke.ts')]),
        ],
        notExplained: [],
      },
      ['shared/policy.ts', 'web/revoke.ts'],
      { specsApart: false },
    );
    expect(revoke?.kind === 'decision' && revoke.elsewhere).toEqual([
      { path: 'shared/policy.ts', stop: 'decision:invite' },
    ]);
  });

  it('keeps specs inside their decision unless the setting sets them apart', () => {
    const review = {
      layers: [
        layer('invite', [step('web/invite.ts'), step('tests/invite.spec.ts')]),
      ],
      notExplained: [],
    };
    const changed = ['tests/invite.spec.ts', 'web/invite.ts'];
    expect(keysAndPaths(review, changed)).toEqual([
      ['briefing', []],
      ['decision:invite', ['web/invite.ts', 'tests/invite.spec.ts']],
    ]);
    const apart = walkthroughStops(review, changed, { specsApart: true });
    expect(apart.map((stop) => [stop.key, stop.paths])).toEqual([
      ['briefing', []],
      ['decision:invite', ['web/invite.ts']],
      ['specs', ['tests/invite.spec.ts']],
    ]);
    expect(apart[1]?.kind === 'decision' && apart[1].elsewhere).toEqual([
      { path: 'tests/invite.spec.ts', stop: 'specs' },
    ]);
  });

  it('claims no file through context steps or pointers outside the current change', () => {
    expect(
      keysAndPaths(
        {
          layers: [
            layer('invite', [
              step('web/invite.ts'),
              step('shared/actor.ts', { kind: 'context' }),
              step('committed/earlier.ts'),
            ]),
          ],
          notExplained: [],
        },
        ['shared/actor.ts', 'web/invite.ts'],
      ),
    ).toEqual([
      ['briefing', []],
      ['decision:invite', ['web/invite.ts']],
      ['unexplained', ['shared/actor.ts']],
    ]);
  });

  it('sends unexplained lines in a spec file set apart to the Specs stop', () => {
    const stops = walkthroughStops(
      {
        layers: [layer('invite', [step('web/invite.ts')])],
        notExplained: [gap('tests/invite.spec.ts', 2, 2)],
      },
      ['tests/invite.spec.ts', 'web/invite.ts'],
      { specsApart: true },
    );
    expect(stops.find((stop) => stop.kind === 'unexplained')).toEqual({
      kind: 'unexplained',
      key: 'unexplained',
      paths: [],
      partial: [{ ...gap('tests/invite.spec.ts', 2, 2), stop: 'specs' }],
    });
  });

  it('lists unexplained lines inside an explained file under the decision that shows the file', () => {
    const stops = walkthroughStops(
      {
        layers: [layer('invite', [step('web/invite.ts')])],
        notExplained: [gap('web/invite.ts', 9, 12)],
      },
      ['web/invite.ts'],
      { specsApart: false },
    );
    expect(stops.at(-1)).toEqual({
      kind: 'unexplained',
      key: 'unexplained',
      paths: [],
      partial: [{ ...gap('web/invite.ts', 9, 12), stop: 'decision:invite' }],
    });
  });

  it('has no unexplained stop when every changed line is explained', () => {
    expect(
      keysAndPaths(
        {
          layers: [layer('invite', [step('web/invite.ts')])],
          notExplained: [],
        },
        ['web/invite.ts'],
      ).map(([key]) => key),
    ).toEqual(['briefing', 'decision:invite']);
  });
});

describe('moving through stops', () => {
  const stops = walkthroughStops(
    {
      layers: [
        layer('invite', [step('a.ts')]),
        layer('revoke', [step('b.ts')]),
      ],
      notExplained: [],
    },
    ['a.ts', 'b.ts'],
    { specsApart: false },
  );

  it('falls back to the briefing when the remembered stop is gone', () => {
    expect(currentStop(stops, 'decision:removed').key).toBe('briefing');
    expect(currentStop(stops, 'decision:revoke').key).toBe('decision:revoke');
  });

  it('steps forward and back and stops at either end', () => {
    expect(neighbourStop(stops, 'briefing', 1)?.key).toBe('decision:invite');
    expect(neighbourStop(stops, 'decision:invite', -1)?.key).toBe('briefing');
    expect(neighbourStop(stops, 'decision:revoke', 1)).toBeUndefined();
    expect(neighbourStop(stops, 'briefing', -1)).toBeUndefined();
  });
});

describe('progress', () => {
  it('counts a file as reviewed only while its mark matches its current content', () => {
    expect(
      filesReviewed(
        ['a.ts', 'b.ts', 'c.ts', 'gone.ts'],
        [
          { path: 'a.ts', reviewStatus: 'reviewed' },
          { path: 'b.ts', reviewStatus: 'stale' },
          { path: 'c.ts', reviewStatus: 'unreviewed' },
        ],
      ),
    ).toEqual({ reviewed: 1, total: 4, done: false });
    expect(
      filesReviewed(['a.ts'], [{ path: 'a.ts', reviewStatus: 'reviewed' }]),
    ).toEqual({ reviewed: 1, total: 1, done: true });
  });

  it('counts a decision reviewed only while its mark matches the current code, and flags moved code either way', () => {
    const mark = (layerId: string, stale: boolean) => ({
      layerId,
      fingerprint: `${layerId}-now`,
      stale,
      reviewedAt: '2026-10-09T00:00:00Z',
    });
    const states = decisionStates(
      [
        layer('invite', [step('a.ts')]),
        layer('revoke', [step('b.ts', { state: 'changed' })]),
        layer('reconnect', [step('c.ts', { state: 'changed' })]),
        layer('export', [step('d.ts')]),
      ],
      {
        worktreeId: 'worktree',
        marks: [
          mark('invite', false),
          mark('revoke', true),
          mark('reconnect', false),
        ],
      },
    );
    expect(Object.fromEntries(states)).toEqual({
      invite: { reviewed: true, stale: false },
      revoke: { reviewed: false, stale: true },
      reconnect: { reviewed: true, stale: true },
      export: { reviewed: false, stale: false },
    });
  });
});

describe('stop completion', () => {
  const stops = walkthroughStops(
    {
      layers: [layer('invite', [step('a.ts'), step('b.ts')])],
      notExplained: [gap('c.ts', 1, 1)],
    },
    ['a.ts', 'b.ts', 'c.ts'],
    { specsApart: false },
  );
  const [briefing, invite, unexplained] = stops;
  const reviewed = (...paths: string[]) =>
    paths.map((path) => ({ path, reviewStatus: 'reviewed' as const }));
  const marked = new Map([['invite', { reviewed: true, stale: false }]]);

  it('finishes a decision only when it is marked and every file it shows is reviewed', () => {
    if (!briefing || !invite || !unexplained) throw new Error('Stops missing');
    expect(stopDone(invite, reviewed('a.ts', 'b.ts'), marked)).toBe(true);
    expect(stopDone(invite, reviewed('a.ts'), marked)).toBe(false);
    expect(stopDone(invite, reviewed('a.ts', 'b.ts'), new Map())).toBe(false);
  });

  it('finishes other stops by their files and never the briefing', () => {
    if (!briefing || !unexplained) throw new Error('Stops missing');
    expect(stopDone(unexplained, reviewed('c.ts'), new Map())).toBe(true);
    expect(stopDone(unexplained, [], new Map())).toBe(false);
    expect(stopDone(briefing, reviewed('a.ts', 'b.ts', 'c.ts'), marked)).toBe(
      false,
    );
  });
});

describe('decision route', () => {
  it('reads the lanes a decision crosses in step order, once per crossing, ignoring context', () => {
    expect(
      decisionRoute(
        layer('invite', [
          step('a.ts', { lane: 0 }),
          step('b.ts', { lane: 1 }),
          step('c.ts', { lane: 1 }),
          step('actor.ts', { lane: 0, kind: 'context' }),
          step('d.ts', { lane: 2 }),
        ]),
      ),
    ).toEqual(['Entry', 'Client', 'Server']);
  });
});

describe('system changes', () => {
  const review: Pick<ReviewResponse, 'diagram' | 'layers'> = {
    layers: [layer('invite', [step('a.ts')]), layer('owners', [step('b.ts')])],
    diagram: {
      after: {
        lanes: ['Behaviors', 'Owners'],
        boxes: [
          {
            id: 'b1',
            lane: 0,
            label: 'Decision invite',
            kind: 'component',
            change: 'changed',
            layerId: 'invite',
          },
          {
            id: 'outbox',
            lane: 1,
            label: 'Delivery outbox',
            kind: 'component',
            change: 'new',
            detail: 'Owns retry identity',
            problem: 'Shares no transaction with the journal',
            layerId: 'owners',
          },
          {
            id: 'policy',
            lane: 1,
            label: 'Workspace policy',
            kind: 'component',
            change: 'changed',
          },
          {
            id: 'legacy',
            lane: 1,
            label: 'Page-owned writes',
            kind: 'storage',
            change: 'removed',
          },
          { id: 'actor', lane: 1, label: 'Actor', kind: 'actor' },
        ],
        arrows: [
          { from: 'b1', to: 'outbox', label: 'enqueues through' },
          { from: 'b1', to: 'outbox', label: 'retries through' },
          { from: 'b1', to: 'policy' },
          { from: 'actor', to: 'b1', label: 'starts' },
          { from: 'policy', to: 'legacy', label: 'replaces' },
        ],
      },
    },
  };

  it('groups the owners a change adds, alters and removes, and every open question, apart from the decisions themselves', () => {
    const parts = systemChanges(review);
    const labels = (items: readonly { label: string }[]) =>
      items.map((item) => item.label);
    expect({
      added: labels(parts.added),
      changed: labels(parts.changed),
      removed: labels(parts.removed),
      questions: labels(parts.questions),
    }).toEqual({
      added: ['Delivery outbox'],
      changed: ['Workspace policy'],
      removed: ['Page-owned writes'],
      questions: ['Delivery outbox'],
    });
    expect(parts.added[0]).toEqual({
      id: 'outbox',
      label: 'Delivery outbox',
      detail: 'Owns retry identity',
      problem: 'Shares no transaction with the journal',
      decision: 2,
    });
  });

  it('describes what a decision connects to once per owner, in both directions', () => {
    expect(
      decisionLinks(review, 'invite').map((link) => [
        link.verb,
        link.outgoing,
        link.part.label,
        link.change,
      ]),
    ).toEqual([
      ['enqueues through', true, 'Delivery outbox', 'new'],
      ['relates to', true, 'Workspace policy', 'changed'],
      ['starts', false, 'Actor', undefined],
    ]);
  });

  it('has nothing to say without a published diagram', () => {
    const plain = { layers: review.layers };
    expect(systemChanges(plain)).toEqual({
      added: [],
      changed: [],
      removed: [],
      questions: [],
    });
    expect(decisionLinks(plain, 'invite')).toEqual([]);
  });
});
