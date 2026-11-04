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
          kind: 'teammate',
          name: 'Review partner',
          message: 'Please cover remote receipt recovery.',
        },
      },
    },
    {
      asked: 'Name all gaps',
      built: 'Explicit owners',
      left: { what: 'Revisit the remaining gap later' },
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
  {
    coverage: [
      {
        asked: 'A',
        built: 'B',
        left: { what: 'C', owner: { kind: 'ticket' } },
      },
    ],
  },
])('refuses an unusable handoff %j', (fields) => {
  expect(
    Result.isFailure(
      Schema.decodeUnknownResult(publishReviewRequestSchema.fields.verdict)({
        ...verdict,
        ...fields,
      }),
    ),
  ).toBe(true);
});

it('accepts an agent-selected timing and bounded decision choices with reusable proof targets', () => {
  const id = '10000000-0000-4000-8000-000000000001';

  expect(
    Result.isFailure(
      Schema.decodeUnknownResult(publishReviewRequestSchema.fields.timing)(
        'automatic',
      ),
    ),
  ).toBe(true);
  const diagram = {
    after: {
      boxes: [
        {
          id,
          label: 'Retention',
          problem: 'How long?',
          layerId: id,
          options: [
            { id, label: 'Keep', consequence: 'The saved snapshot remains.' },
            {
              id: '10000000-0000-4000-8000-000000000002',
              label: 'Expire',
              consequence: 'Old code is lost.',
            },
          ],
        },
      ],
      arrows: [],
    },
  };
  expect(
    Schema.decodeUnknownSync(publishReviewRequestSchema.fields.diagram)(
      diagram,
    ),
  ).toEqual(diagram);
  expect(
    Result.isFailure(
      Schema.decodeUnknownResult(publishReviewRequestSchema.fields.diagram)({
        after: {
          ...diagram.after,
          boxes: [
            {
              ...diagram.after.boxes[0],
              options: [{ id, label: '', consequence: 'No label' }],
            },
          ],
        },
      }),
    ),
  ).toBe(true);
  const proof = {
    assets: [
      {
        kind: 'video',
        title: 'The option in use',
        path: 'option.webm',
        layerId: id,
        optionId: id,
      },
    ],
  };
  expect(
    Schema.decodeUnknownSync(publishReviewRequestSchema.fields.proof)(proof),
  ).toEqual(proof);
});

it.each(['decision', 'record'])('keeps the agent timing %s', (timing) => {
  expect(
    Schema.decodeUnknownSync(publishReviewRequestSchema.fields.timing)(timing),
  ).toBe(timing);
});
