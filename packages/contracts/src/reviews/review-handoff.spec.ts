import { Result, Schema } from 'effect';
import { expect, it } from 'vitest';
import { publishReviewRequestSchema } from './review.ts';
import { publishReviewToolRequestSchema } from './review-tools.ts';

const verdict = {
  asked: { text: 'Make review handoffs actionable' },
  recommendation: 'hold',
  reasons: ['Owner approval is required'],
  notProven: [],
  removed: [],
};
const handoff = {
  tryIt: {
    url: 'https://preview.example.test/review',
    accounts: [
      { label: 'Returning developer', signIn: 'Select the fixture persona' },
    ],
    steps: ['Open a decision', 'Send feedback'],
  },
  coverage: [
    { asked: 'Try the feature', built: 'Preview instructions' },
    {
      asked: 'Cover remote delivery',
      built: 'Local delivery',
      left: {
        what: 'Remote hosts',
        owner: {
          kind: 'ticket',
          name: 'Remote feedback',
          message: 'Please cover remote receipt recovery.',
        },
      },
    },
    {
      asked: 'Name all gaps',
      built: 'Explicit owners',
      left: { what: 'Assign the remaining gap', owner: { kind: 'nobody' } },
    },
  ],
};
it.each([
  ['HTTP', publishReviewRequestSchema.fields.verdict],
  ['MCP', publishReviewToolRequestSchema.fields.verdict],
])(
  'keeps optional handoff data in the %s verdict and accepts old reviews',
  (_, schema) => {
    expect(Schema.decodeUnknownSync(schema)(verdict)).toEqual(verdict);
    expect(
      Schema.decodeUnknownSync(schema)({ ...verdict, ...handoff }),
    ).toEqual({ ...verdict, ...handoff });
  },
);
it.each([
  { tryIt: { ...handoff.tryIt, url: 'javascript:alert(1)' } },
  { tryIt: { ...handoff.tryIt, steps: [] } },
  {
    coverage: [
      {
        asked: 'A',
        built: 'B',
        left: { what: 'C', owner: { kind: 'teammate' } },
      },
    ],
  },
  { coverage: [{ asked: 'A', built: 'B', left: { what: 'C' } }] },
])('refuses an unusable or ownerless handoff %j', (fields) => {
  expect(
    Result.isFailure(
      Schema.decodeUnknownResult(publishReviewRequestSchema.fields.verdict)({
        ...verdict,
        ...fields,
      }),
    ),
  ).toBe(true);
});
