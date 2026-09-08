import { expect, it } from 'vitest';
import { replaceReviewLayersSchema } from './review-layers.ts';

const id = '12345678-1234-4234-8234-123456789abc';
const layer = {
  id,
  title: 'Layer',
  files: [{ path: 'file.ts', scope: 'staged' }],
};
it('bounds metadata and rejects duplicate identities and references without normalizing paths', () => {
  const parse = (layers: unknown, expectedRevision = 0) =>
    replaceReviewLayersSchema.safeParse({ expectedRevision, layers }).success;
  expect(parse([layer])).toBe(true);
  expect(
    parse([
      {
        ...layer,
        files: [...layer.files, { path: 'file.ts', scope: 'unstaged' }],
      },
    ]),
  ).toBe(true);
  expect(
    parse([layer, { ...layer, id: '22345678-1234-4234-8234-123456789abc' }]),
  ).toBe(false);
  expect(parse([layer, { ...layer, files: [] }])).toBe(false);
  expect(parse([{ ...layer, title: ' ' }])).toBe(false);
  expect(parse([{ ...layer, title: 'x'.repeat(201) }])).toBe(false);
  expect(
    parse([{ ...layer, files: [{ path: 'x'.repeat(4097), scope: 'staged' }] }]),
  ).toBe(false);
  expect(
    parse([
      {
        ...layer,
        files: Array.from({ length: 501 }, (_, i) => ({
          path: `file${i}`,
          scope: 'staged',
        })),
      },
    ]),
  ).toBe(false);
  const uniqueLayers = Array.from({ length: 101 }, (_, index) => ({
    id: `${index.toString(16).padStart(8, '0')}-1234-4234-8234-123456789abc`,
    title: 'Layer',
    files: [],
  }));
  expect(parse(uniqueLayers.slice(0, 100))).toBe(true);
  expect(parse(uniqueLayers)).toBe(false);
  expect(
    parse(
      Array.from({ length: 5 }, (_, i) => ({
        id: `${i}2345678-1234-4234-8234-123456789abc`,
        title: 'Layer',
        files: Array.from({ length: 500 }, (_, j) => ({
          path: `${i}/${j}`,
          scope: 'staged',
        })),
      })),
    ),
  ).toBe(false);
  expect(parse([], -1)).toBe(false);
  expect(parse([], 0.5)).toBe(false);
  expect(parse([], Number.MAX_SAFE_INTEGER)).toBe(false);
  expect(parse([{ ...layer, files: [{ path: 'file', scope: 'all' }] }])).toBe(
    false,
  );
});
