import { expect, it } from 'vite-plus/test';
import type { WalkthroughModel } from '../models/walkthrough.ts';
import {
  codexModelFamily,
  latestWalkthroughWriter,
} from './walkthrough-writer.ts';

const codex = (
  model: string,
  efforts: WalkthroughModel['efforts'] = ['low', 'medium', 'high', 'xhigh'],
): WalkthroughModel => ({
  provider: 'codex',
  model,
  label: model,
  family: codexModelFamily(model),
  efforts,
  defaultEffort: 'medium',
});

const listed = [
  codex('gpt-6.2-sol'),
  codex('gpt-6.2-astra', ['low', 'medium', 'high']),
  codex('gpt-6.1-terra'),
  codex('gpt-6.1-sol'),
  codex('gpt-6-astra'),
  codex('gpt-6-sol'),
  codex('gpt-6-luna'),
  codex('gpt-5.6-sol'),
];

it('names a Codex family only for gpt-<version>-<family> slugs', () => {
  expect(
    [
      'gpt-6.2-sol',
      'gpt-6.1-terra',
      'gpt-6-luna',
      'gpt-5.6-sol',
      'gpt-reserve',
      'codex-auto-review',
    ].map(codexModelFamily),
  ).toEqual(['Sol', 'Terra', 'Luna', 'Sol', undefined, undefined]);
});

it('follows the first listed model of the saved family', () => {
  expect(
    latestWalkthroughWriter(
      {
        provider: 'codex',
        model: 'gpt-5.6-sol',
        effort: 'high',
        latest: 'Sol',
      },
      listed,
    ),
  ).toEqual({
    provider: 'codex',
    model: 'gpt-6.2-sol',
    effort: 'high',
    latest: 'Sol',
  });
});

it('uses the newest model’s default effort when it lacks the saved one', () => {
  expect(
    latestWalkthroughWriter(
      {
        provider: 'codex',
        model: 'gpt-6-astra',
        effort: 'xhigh',
        latest: 'Astra',
      },
      listed,
    ),
  ).toEqual({
    provider: 'codex',
    model: 'gpt-6.2-astra',
    effort: 'medium',
    latest: 'Astra',
  });
});

it('keeps a pinned model and the last resolved model when the family is gone', () => {
  const pinned = {
    provider: 'codex',
    model: 'gpt-6-sol',
    effort: 'low',
  } as const;
  expect(latestWalkthroughWriter(pinned, listed)).toBe(pinned);
  const orphan = {
    provider: 'codex',
    model: 'gpt-5-nova',
    effort: 'low',
    latest: 'Nova',
  } as const;
  expect(latestWalkthroughWriter(orphan, listed)).toBe(orphan);
});
