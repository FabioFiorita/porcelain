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
    whenWritten: 'Passing when written, at abcdef1',
    more: true,
    results: [
      { name: 'Unit tests', tone: 'passed' as const },
      { name: 'Browser tests', tone: 'passed' as const },
    ],
  };

  it('reads the captured checks when the pull request says nothing newer', () => {
    expect(verifiedChecksLine(recorded, undefined, 'passed')).toEqual({
      text: 'Checks passing at abcdef1: Unit tests, Browser tests and more',
      captured: undefined,
    });
  });

  it('leads with the live result and says what passed when it was written', () => {
    expect(
      verifiedChecksLine(
        recorded,
        {
          label: 'Failing now',
          names: ['Browser tests'],
        },
        'passed',
      ),
    ).toEqual({
      text: 'Failing now: Browser tests',
      captured:
        'Passing when written, at abcdef1: Unit tests, Browser tests and more',
    });
    expect(
      verifiedChecksLine(
        { ...recorded, more: false, results: [] },
        {
          label: 'No checks now',
          names: [],
        },
        'passed',
      ),
    ).toEqual({
      text: 'No checks now',
      captured: 'Passing when written, at abcdef1',
    });
  });

  it('names only the checks that failed and counts the passing ones', () => {
    const failing = {
      label: 'Checks failing at abcdef1',
      whenWritten: 'Failing when written, at abcdef1',
      more: false,
      results: [
        { name: 'Unit tests', tone: 'passed' as const },
        { name: 'Browser tests', tone: 'failed' as const },
        { name: 'Lint', tone: 'passed' as const },
      ],
    };
    expect(verifiedChecksLine(failing, undefined, 'failed').text).toBe(
      'Checks failing at abcdef1: Browser tests and 2 passing',
    );
    expect(
      verifiedChecksLine({ ...failing, more: true }, undefined, 'failed').text,
    ).toBe('Checks failing at abcdef1: Browser tests and 2 passing, and more');
    expect(
      verifiedChecksLine(failing, { label: 'Passing now', names: [] }, 'failed')
        .captured,
    ).toBe('Failing when written, at abcdef1: Browser tests and 2 passing');
  });
});

describe('verifiedChecks', () => {
  const captured = {
    headOid: 'c'.repeat(40),
    state: 'SUCCESS',
    checksTruncated: false,
    results: [{ name: 'Unit tests', status: 'SUCCESS' }],
  };

  it('keeps the captured result under Verified while the pull request has not been read', () => {
    const { changed, unchanged } = verifiedChecks(
      [{ checks: captured, step: 2 }],
      undefined,
    );
    expect(changed).toHaveLength(0);
    expect(unchanged).toHaveLength(1);
    expect(unchanged[0]?.step).toBe(2);
    expect(unchanged[0]?.tone).toBe('passed');
    expect(unchanged[0]?.line.text).toBe(
      'Checks passing at ccccccc: Unit tests',
    );
  });

  it('moves a newer failure on the same commit out of Verified and names a moved head', () => {
    const failing = {
      headSha: 'c'.repeat(40),
      checksTruncated: false,
      checks: [
        { name: 'Unit tests', status: 'COMPLETED', conclusion: 'FAILURE' },
      ],
    };
    const { changed, unchanged } = verifiedChecks(
      [{ checks: captured, step: 1 }],
      {
        status: failing,
        detail: { headSha: 'd'.repeat(40) },
      },
    );
    expect(unchanged).toHaveLength(0);
    expect(changed[0]?.tone).toBe('failed');
    expect(changed[0]?.line.text).toBe('Failing now: Unit tests');
    expect(changed[0]?.line.captured).toBe(
      'Passing when written, at ccccccc: Unit tests',
    );
    expect(changed[0]?.moved).toBe('ddddddd');
  });
});
