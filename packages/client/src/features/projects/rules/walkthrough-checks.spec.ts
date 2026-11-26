import { describe, expect, it } from 'vite-plus/test';
import {
  movedPullHead,
  verifiedChecks,
  verifiedChecksLine,
} from './walkthrough-checks.ts';

it('names the pull request head only when it moved past the captured commit', () => {
  expect(movedPullHead('b'.repeat(40), 'a'.repeat(40))).toBe('bbbbbbb');
  expect(movedPullHead('a'.repeat(40), 'a'.repeat(40))).toBeUndefined();
  expect(movedPullHead(undefined, 'a'.repeat(40))).toBeUndefined();
});

describe('verifiedChecksLine', () => {
  const recorded = {
    label: 'Checks passing at abcdef1',
    more: true,
    results: [{ name: 'Unit tests' }, { name: 'Browser tests' }],
  };

  it('reads the captured checks when the pull request says nothing newer', () => {
    expect(verifiedChecksLine(recorded, undefined)).toEqual({
      text: 'Checks passing at abcdef1: Unit tests, Browser tests and more',
      captured: undefined,
    });
  });

  it('leads with the live result and keeps the captured one beneath it', () => {
    expect(
      verifiedChecksLine(recorded, {
        label: 'Now failing',
        names: ['Browser tests'],
      }),
    ).toEqual({
      text: 'Now failing: Browser tests',
      captured:
        'Captured: Checks passing at abcdef1: Unit tests, Browser tests and more',
    });
    expect(
      verifiedChecksLine(
        { ...recorded, more: false, results: [] },
        {
          label: 'No checks now',
          names: [],
        },
      ),
    ).toEqual({
      text: 'No checks now',
      captured: 'Captured: Checks passing at abcdef1',
    });
  });
});

describe('verifiedChecks', () => {
  const captured = {
    headOid: 'c'.repeat(40),
    state: 'SUCCESS',
    checksTruncated: false,
    results: [{ name: 'Unit tests', status: 'SUCCESS' }],
  };

  it('keeps the captured result while the pull request has not been read', () => {
    expect(verifiedChecks([{ checks: captured, step: 2 }], undefined)).toEqual([
      expect.objectContaining({
        step: 2,
        tone: 'passed',
        live: undefined,
        moved: undefined,
        line: {
          text: 'Checks passing at ccccccc: Unit tests',
          captured: undefined,
        },
      }),
    ]);
  });

  it('shows a newer failure on the same commit and names a moved head', () => {
    const failing = {
      headSha: 'c'.repeat(40),
      checksTruncated: false,
      checks: [
        { name: 'Unit tests', status: 'COMPLETED', conclusion: 'FAILURE' },
      ],
    };
    const [row] = verifiedChecks([{ checks: captured, step: 1 }], {
      status: failing,
      detail: { headSha: 'd'.repeat(40) },
    });
    expect(row?.tone).toBe('failed');
    expect(row?.line.text).toBe('Now failing: Unit tests');
    expect(row?.moved).toBe('ddddddd');
  });
});
