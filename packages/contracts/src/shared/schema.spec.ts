import { Result, Schema } from 'effect';
import { expect, it } from 'vitest';
import { isoDateTimeSchema } from './schema.ts';

it.each([
  '2026-10-06T10:00:00Z',
  '2026-10-06T10:00:00.123456Z',
  '2024-02-29T23:59:59.999Z',
  '2000-02-29T00:00:00Z',
  '0000-02-29T00:00:00Z',
])(
  'keeps the valid UTC wire timestamp %s without normalizing its precision',
  (value) => {
    expect(Schema.decodeUnknownSync(isoDateTimeSchema)(value)).toBe(value);
    expect(Schema.encodeSync(isoDateTimeSchema)(value)).toBe(value);
  },
);

it.each([
  '2026-02-29T10:00:00Z',
  '1900-02-29T10:00:00Z',
  '2026-02-30T10:00:00Z',
  '2026-04-31T10:00:00Z',
  '2026-10-06T24:00:00Z',
  '2026-10-06T10:00:60Z',
  '2026-10-06T10:00Z',
  '2026-10-06T10:00:00+00:00',
  '2026-10-06T10:00:00',
  '2026-10-06T10:00:00Z\n',
  '2026-10-06',
])('refuses the malformed or impossible UTC timestamp %s', (value) => {
  expect(
    Result.isFailure(Schema.decodeUnknownResult(isoDateTimeSchema)(value)),
  ).toBe(true);
});
