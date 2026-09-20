import { expect, it } from 'vitest';
import {
  evidenceFingerprintSchema,
  reviewedMarksResponseSchema,
  setReviewedRequestSchema,
} from './reviewed-files.ts';

it('limits reviewed marks to canonical paths and SHA-256 fingerprints', () => {
  const fingerprint = 'a'.repeat(64);
  expect(evidenceFingerprintSchema.parse(fingerprint)).toBe(fingerprint);
  expect(() => evidenceFingerprintSchema.parse('status-token')).toThrow();
  expect(
    reviewedMarksResponseSchema.parse({
      worktreeId: 'fac0e50fb0194e469dd1efcb6af7dc09',
      marks: [
        {
          path: 'src/file.ts',
          fingerprint,
          reviewedAt: '2026-09-13T00:00:00.000Z',
        },
      ],
    }),
  ).toMatchObject({ marks: [{ path: 'src/file.ts', fingerprint }] });
  expect(() =>
    setReviewedRequestSchema.parse({
      path: 'src/file.ts',
      reviewed: true,
      fingerprint,
      statusToken: fingerprint,
    }),
  ).toThrow();
});
