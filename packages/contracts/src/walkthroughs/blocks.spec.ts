import { Schema } from 'effect';
import { expect, it } from 'vite-plus/test';
import {
  walkthroughBlockRequestSchema,
  walkthroughBlockSchema,
  walkthroughContentSchema,
} from './index.ts';

it('exposes recorded check results on the wire and only accepts the commit as a request', () => {
  const block = {
    kind: 'checks',
    headOid: 'captured-head',
    state: 'SUCCESS',
    checksTruncated: false,
    results: [{ name: 'Tests', status: 'SUCCESS' }],
  };
  expect(Schema.decodeUnknownSync(walkthroughBlockSchema)(block)).toEqual({
    kind: 'checks',
    headOid: 'captured-head',
    state: 'SUCCESS',
    checksTruncated: false,
    results: [{ name: 'Tests', status: 'SUCCESS' }],
  });
  const decodeRequest = Schema.decodeUnknownSync(
    walkthroughBlockRequestSchema,
    {
      onExcessProperty: 'error',
    },
  );
  expect(decodeRequest({ kind: 'checks', headOid: 'captured-head' })).toEqual({
    kind: 'checks',
    headOid: 'captured-head',
  });
  expect(() => decodeRequest(block)).toThrow();
});

it('reads future content versions without losing steps or reordering unsupported blocks', () => {
  const result = Schema.decodeUnknownSync(walkthroughContentSchema)({
    version: 2,
    outcome: 'worth_knowing',
    title: 'A future walkthrough',
    summary: 'Keep the prose.',
    growth: [],
    onlyInTranscript: [],
    stillUnclear: [],
    stops: [
      {
        title: 'A step',
        explanation: 'Read this step.',
        blocks: [
          { kind: 'future', markup: '<p>Ignore this</p>' },
          { kind: 'files', files: [{ path: 'file.ts', note: 'Owned' }] },
        ],
      },
    ],
  });
  expect(result.version).toBe(2);
  expect(Schema.encodeSync(walkthroughContentSchema)(result).version).toBe(2);
  expect(result.stops).toEqual([
    {
      title: 'A step',
      explanation: 'Read this step.',
      blocks: [
        { kind: 'unknown' },
        { kind: 'files', files: [{ path: 'file.ts', note: 'Owned' }] },
      ],
    },
  ]);
});

it.each([
  {
    input: { outcome: 'future_outcome' },
    expected: { outcome: 'worth_knowing' },
  },
  {
    input: {
      growth: [
        { change: 'future_change', what: 'Paths', note: 'Keep this detail.' },
      ],
    },
    expected: {
      growth: [{ change: 'changed', what: 'Paths', note: 'Keep this detail.' }],
    },
  },
  {
    input: {
      stops: [
        {
          title: 'A step',
          explanation: 'Keep this step.',
          blocks: [
            {
              kind: 'callout',
              attention: {
                kind: 'future_call',
                note: 'Readers prefer it.',
                question: 'Keep it?',
              },
              comparison: { columns: ['A', 'B'], rows: [['Keep', 'Remove']] },
            },
          ],
        },
      ],
    },
    expected: {
      stops: [
        {
          title: 'A step',
          explanation: 'Keep this step.',
          blocks: [
            {
              kind: 'callout',
              attention: {
                kind: 'decision',
                note: 'Readers prefer it.',
                question: 'Keep it?',
              },
              comparison: { columns: ['A', 'B'], rows: [['Keep', 'Remove']] },
            },
          ],
        },
      ],
    },
  },
])(
  'keeps the walkthrough readable with future values in $input',
  ({ input, expected }) => {
    const read = Schema.decodeUnknownSync(walkthroughContentSchema)({
      version: 2,
      outcome: 'worth_knowing',
      title: 'A future walkthrough',
      summary: 'Keep the prose.',
      growth: [],
      stops: [],
      onlyInTranscript: [],
      stillUnclear: [],
      ...input,
    });
    expect(read).toMatchObject({
      title: 'A future walkthrough',
      summary: 'Keep the prose.',
      ...expected,
    });
  },
);
