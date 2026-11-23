import { expect, it } from 'vite-plus/test';
import {
  canSaveWalkthroughWriter,
  walkthroughWriterStatus,
  type WriterSettings,
} from './walkthrough-writer.ts';

const settings: WriterSettings = {
  writer: { provider: 'claude', model: 'claude-opus-5-5', effort: 'high' },
  models: [
    {
      provider: 'claude',
      model: 'claude-opus-5-5',
      label: 'Opus 5.5',
      efforts: ['high'],
      defaultEffort: 'high',
    },
  ],
};

it('names the available default writer before starting a walkthrough', () => {
  expect(walkthroughWriterStatus(settings)).toEqual({
    available: true,
    label: 'Claude / Opus 5.5 · high',
  });
});

it('does not substitute the default when the project writer is unavailable', () => {
  expect(
    walkthroughWriterStatus(settings, {
      provider: 'codex',
      model: 'missing-model',
      effort: 'medium',
    }),
  ).toEqual({
    available: false,
    label: 'Codex / missing-model · medium',
  });
});

it('keeps the chosen writer visible when no coding CLI is available', () => {
  expect(walkthroughWriterStatus({ ...settings, models: [] })).toEqual({
    available: false,
    label: 'Claude / claude-opus-5-5 · high',
  });
});
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
