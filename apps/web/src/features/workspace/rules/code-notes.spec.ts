import { describe, expect, it } from 'vitest';
import type { ReviewLayer } from '@porcelain/client/reviews/rules';
import { decisionNotes, gapNotes, mergeNotes } from './code-notes';

const step = (
  title: string,
  path: string,
  location: ReviewLayer['steps'][number]['location'],
): ReviewLayer['steps'][number] => ({
  id: title,
  title,
  lane: 0,
  text: `${title} explained`,
  kind: 'changed',
  pointer: { path, startLine: 2, endLine: 4, textFingerprint: 'source' },
  location,
});
const layer: ReviewLayer = {
  id: 'invite',
  title: 'Invite a teammate',
  summary: 'Invitations reuse workspace policy',
  lanes: ['Entry'],
  fingerprint: 'now',
  steps: [
    step('Submit', 'web/invite.ts', {
      state: 'current',
      startLine: 5,
      endLine: 8,
    }),
    step('Authorize', 'server/invite.ts', { state: 'changed' }),
    step('Earlier', 'server/invite.ts', {
      state: 'committed',
      startLine: 1,
      endLine: 2,
    }),
  ],
};

describe('code notes', () => {
  it('numbers each step note in walkthrough order at the end of the code it explains now', () => {
    expect(decisionNotes(layer)).toEqual({
      'web/invite.ts': [
        {
          title: 'Submit',
          text: 'Submit explained',
          line: 8,
          stale: false,
          marker: '1',
          tone: 'agent',
        },
      ],
      'server/invite.ts': [
        {
          title: 'Authorize',
          text: 'Authorize explained',
          line: 4,
          stale: true,
          marker: '2',
          tone: 'agent',
        },
      ],
    });
  });

  it('names the decision on every note when notes from several decisions share one document', () => {
    expect(
      decisionNotes(layer, 3)['web/invite.ts']?.map((note) => [
        note.marker,
        note.title,
      ]),
    ).toEqual([['3.1', '3. Invite a teammate · Submit']]);
  });

  it('marks every unexplained range where it ends and merges notes per file in order', () => {
    const merged = mergeNotes(
      decisionNotes(layer),
      gapNotes([
        {
          path: 'web/invite.ts',
          ranges: [
            { startLine: 11, endLine: 12 },
            { startLine: 20, endLine: 20 },
          ],
        },
      ]),
    );
    expect(
      merged['web/invite.ts']?.map((note) => [note.tone, note.line, note.text]),
    ).toEqual([
      ['agent', 8, 'Submit explained'],
      ['gap', 12, 'Lines 11–12 changed without an explanation from the agent.'],
      ['gap', 20, 'Line 20 changed without an explanation from the agent.'],
    ]);
  });
});
