import { expect, it } from 'vitest';
import {
  teachRequest,
  optionRequest,
  guardRequest,
} from './review-requests.ts';
it('ties a plain explanation and an option pick to their decision through normal comments', () => {
  const layer = { id: 'one', title: 'Keep a snapshot' };

  expect(teachRequest(layer)).toBe(
    'Decision: Keep a snapshot\n\nTeach me this decision in plain words. Why choose this over the alternatives? What did it trade off? Reply on this thread.',
  );
  expect(
    optionRequest(
      { label: 'Retention', problem: 'How long?' },
      { id: 'keep', label: 'Forever', consequence: 'Old code stays readable.' },
    ),
  ).toBe(
    'Question: Retention\n\nHow long?\n\nI choose “Forever”. Old code stays readable.',
  );
});
it('asks for the strongest guard with a failing past case and one approval-bound PR per guard', () => {
  expect(
    guardRequest({
      id: 'one',
      lane: 0,
      title: 'Retain code',
      text: '',
      kind: 'changed',
      pointer: {
        path: 'snapshot.ts',
        startLine: 1,
        endLine: 3,
        textFingerprint: 'hash',
      },
      location: { state: 'current', startLine: 1, endLine: 3 },
    }),
  ).toBe(
    "Add a guard for this past mistake at snapshot.ts:1–3 (Retain code). Choose the strongest suitable layer: architecture, types, a lint rule, then a test; use words only as a last resort. Prove the guard fails on the past mistake, then passes with the fix. Open one pull request per guard and leave each waiting for the owner's approval. This request does not authorize merging.",
  );
});
