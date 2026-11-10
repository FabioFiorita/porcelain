import { expect, it } from 'vitest';
import { canSaveWalkthroughWriter } from './walkthrough-writer.ts';
it('allows disabling automation with an unchanged unavailable writer while refusing a different unavailable choice', () => {
  const input = {
    writer: 'codex:removed-model',
    effort: 'high',
    current: { provider: 'codex', model: 'removed-model', effort: 'high' },
    project: true,
    models: [],
  };
  expect(canSaveWalkthroughWriter(input)).toBe(true);
  expect(
    canSaveWalkthroughWriter({ ...input, writer: 'codex:another-model' }),
  ).toBe(false);
  expect(canSaveWalkthroughWriter({ ...input, effort: 'ultra' })).toBe(false);
  expect(canSaveWalkthroughWriter({ ...input, project: false })).toBe(false);
});
