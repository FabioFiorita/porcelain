import { describe, expect, it } from 'vite-plus/test';
import type { WalkthroughContent } from '../models/walkthrough.ts';
import { callOptions, isDecisionAllowed } from './decisions.ts';

type Block = WalkthroughContent['stops'][number]['blocks'][number];

const callout = (columns?: string[]): Block => ({
  kind: 'callout',
  attention: { kind: 'product', note: 'Why.', question: 'Which?' },
  ...(columns ? { comparison: { columns, rows: [] } } : {}),
});

const stops: WalkthroughContent['stops'] = [
  { title: 'Read', explanation: '', blocks: [] },
  {
    title: 'Choose',
    explanation: '',
    blocks: [
      { kind: 'files', files: [] },
      callout(['Show all notes', 'Show no notes']),
      callout(),
    ],
  },
];

describe('call decisions', () => {
  it('finds a call by its step and its position among the step callouts', () => {
    expect(callOptions(stops, 2, 0)).toEqual([
      'Show all notes',
      'Show no notes',
    ]);
    expect(callOptions(stops, 2, 1)).toEqual([]);
    expect(callOptions(stops, 1, 0)).toBeUndefined();
    expect(callOptions(stops, 2, 2)).toBeUndefined();
    expect(callOptions(stops, 3, 0)).toBeUndefined();
  });

  it('accepts only an option the comparison offers, or none', () => {
    expect(isDecisionAllowed(stops, 2, 0, 'Show no notes')).toBe(true);
    expect(isDecisionAllowed(stops, 2, 0, undefined)).toBe(true);
    expect(isDecisionAllowed(stops, 2, 0, 'Show some notes')).toBe(false);
    expect(isDecisionAllowed(stops, 2, 1, 'Show all notes')).toBe(false);
    expect(isDecisionAllowed(stops, 1, 0, undefined)).toBe(false);
  });
});
