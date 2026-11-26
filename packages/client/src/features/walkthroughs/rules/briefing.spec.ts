import { describe, expect, it } from 'vite-plus/test';
import {
  callDecision,
  callDecisionRequest,
  callOptions,
  decidedOption,
  decisionAuthor,
  nothingCaptured,
  walkthroughPullRequest,
  walkthroughVerified,
} from './briefing.ts';
import type { WalkthroughStop } from './blocks.ts';
import type { WalkthroughContent } from './walkthrough.ts';

const pull = (number: number, headBranch: string, state: string) => ({
  number,
  headBranch,
  state,
});

describe('walkthroughPullRequest', () => {
  const run = { branch: 'feature', pullRequestNumber: 7 };

  it('prefers the open pull request of the branch over the one the run named', () => {
    expect(
      walkthroughPullRequest(
        [pull(7, 'other', 'open'), pull(9, 'feature', 'open')],
        run,
      )?.number,
    ).toBe(9);
  });

  it('falls back to the run’s pull request, then to a closed one of the branch', () => {
    expect(
      walkthroughPullRequest(
        [pull(3, 'feature', 'merged'), pull(7, 'other', 'closed')],
        run,
      )?.number,
    ).toBe(7);
    expect(
      walkthroughPullRequest([pull(3, 'feature', 'merged')], {
        branch: 'feature',
        pullRequestNumber: undefined,
      })?.number,
    ).toBe(3);
    expect(walkthroughPullRequest([], run)).toBeUndefined();
  });
});

const stop = (blocks: WalkthroughStop['blocks']): WalkthroughStop => ({
  title: 'A step',
  explanation: 'Why.',
  blocks,
  callouts: [],
});
const checks = {
  kind: 'checks' as const,
  checks: {
    headOid: 'c'.repeat(40),
    state: 'SUCCESS',
    checksTruncated: false,
    results: [{ name: 'Unit tests', status: 'SUCCESS' }],
  },
};
const images = {
  kind: 'images' as const,
  screenshots: [],
  first: 0,
};
const content = (stops: WalkthroughStop[]): WalkthroughContent => ({
  outcome: 'needs_you',
  title: 'A change',
  summary: 'What changed.',
  growth: [],
  stops,
  onlyInTranscript: [],
  stillUnclear: [],
});

describe('walkthroughVerified', () => {
  it('lists each step’s captured checks and counts the screenshot pairs with their steps', () => {
    const verified = walkthroughVerified(
      content([stop([images]), stop([checks, images])]),
    );
    expect(verified.checks).toEqual([{ checks: checks.checks, step: 2 }]);
    expect(verified.screenshots).toEqual({
      text: '2 before and after pairs',
      steps: 'Steps 1, 2',
      first: 1,
    });
  });

  it('says one pair once and nothing when no step captured screenshots', () => {
    expect(
      walkthroughVerified(content([stop([]), stop([images])])).screenshots,
    ).toEqual({
      text: 'Before and after screenshots',
      steps: 'Step 2',
      first: 2,
    });
    expect(walkthroughVerified(content([stop([checks])])).screenshots).toBe(
      undefined,
    );
  });
});

it('names the commit nothing was captured for', () => {
  expect(nothingCaptured({ headOid: 'abcdef1234567' })).toBe(
    'No checks or screenshots were captured for abcdef1.',
  );
});

it('says who decided a call and which option they chose', () => {
  expect(decisionAuthor({ decidedBy: { kind: 'owner' } })).toBe('by the owner');
  expect(decisionAuthor({ decidedBy: { kind: 'device' } })).toBe(
    'from a paired device',
  );
  expect(decidedOption({ option: 'Show all notes' })).toBe(
    'Decided: Show all notes',
  );
  expect(decidedOption({ option: undefined })).toBe('Decided');
});

describe('call decisions', () => {
  const decided = {
    step: 1,
    call: 0,
    option: 'Show all notes',
    decidedBy: { kind: 'owner' },
    decidedAt: '2026-11-25T10:00:00.000Z',
  };

  it('finds the decision of one call in its step', () => {
    expect(callDecision([decided], 1, 0)).toBe(decided);
    expect(callDecision([decided], 1, 1)).toBeUndefined();
    expect(callDecision(undefined, 1, 0)).toBeUndefined();
  });

  it('offers each comparison column as an option, or none', () => {
    expect(callOptions({ columns: ['Show all', 'Show none'] })).toEqual([
      'Show all',
      'Show none',
    ]);
    expect(callOptions(undefined)).toEqual([]);
  });

  it('sends the chosen option with a decision and nothing else with an undo', () => {
    expect(
      callDecisionRequest({ step: 2, call: 1, decided: true, option: 'Keep' }),
    ).toEqual({ step: 2, call: 1, decided: true, option: 'Keep' });
    expect(callDecisionRequest({ step: 2, call: 1, decided: true })).toEqual({
      step: 2,
      call: 1,
      decided: true,
    });
    expect(
      callDecisionRequest({ step: 2, call: 1, decided: false, option: 'Keep' }),
    ).toEqual({ step: 2, call: 1, decided: false });
  });
});
