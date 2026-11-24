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

const stepWith = (block: object) => [
  { title: 'A step', explanation: 'Read this step.', blocks: [block] },
];

it.each([
  { name: 'an unsupported version', fields: { version: 2 } },
  { name: 'an unknown outcome', fields: { outcome: 'future_outcome' } },
  {
    name: 'an unknown growth change',
    fields: {
      growth: [{ change: 'future_change', what: 'Paths', note: 'Moved.' }],
    },
  },
  {
    name: 'an unknown callout kind',
    fields: {
      stops: stepWith({
        kind: 'callout',
        attention: {
          kind: 'future_call',
          note: 'It matters.',
          question: 'Keep it?',
        },
      }),
    },
  },
  {
    name: 'an unknown block kind',
    fields: { stops: stepWith({ kind: 'future_block' }) },
  },
  {
    name: 'a malformed files block',
    fields: {
      stops: stepWith({ kind: 'files', files: [{ path: 'file.ts' }] }),
    },
  },
])('rejects $name in wire content', ({ fields }) => {
  const content = {
    version: 1,
    outcome: 'worth_knowing',
    title: 'A walkthrough',
    summary: 'The change.',
    growth: [],
    stops: [],
    onlyInTranscript: [],
    stillUnclear: [],
    ...fields,
  };
  expect(() =>
    Schema.decodeUnknownSync(walkthroughContentSchema)(content),
  ).toThrow();
});
