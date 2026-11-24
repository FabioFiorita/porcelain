import { expect, it } from 'vite-plus/test';
import {
  canSaveWalkthroughWriter,
  walkthroughWriterStatus,
  type WriterSettings,
} from './walkthrough-writer.ts';

const settings: WriterSettings = {
  writer: { provider: 'claude', model: 'claude-opus-5-5', effort: 'high' },
  availability: 'ready',
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
    availability: 'ready',
    label: 'Claude / Opus 5.5 · high',
    block: undefined,
  });
});

it('keeps the chosen writer visible when no coding CLI is available', () => {
  expect(
    walkthroughWriterStatus({
      ...settings,
      availability: 'missing-model',
      models: [],
    }),
  ).toEqual({
    availability: 'missing-model',
    label: 'Claude / claude-opus-5-5 · high',
    block: 'Claude / claude-opus-5-5 · high is unavailable.',
  });
});

it('uses the server decision even when the displayed catalog lists the saved effort', () => {
  expect(
    walkthroughWriterStatus({
      ...settings,
      availability: 'unsupported-effort',
    }),
  ).toEqual({
    availability: 'unsupported-effort',
    label: 'Claude / Opus 5.5 · high',
    block: "Opus 5.5 doesn't support high effort.",
  });
});

it('keeps a legacy settings response usable without inferring the writer status', () => {
  expect(
    walkthroughWriterStatus({
      writer: settings.writer,
      models: settings.models,
    }).block,
  ).toBeUndefined();
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

it('blocks saving a listed model with an unsupported effort even when the saved writer is unchanged', () => {
  const input = {
    writer: 'claude:claude-opus-5-5',
    effort: 'medium',
    current: { ...settings.writer, effort: 'medium' },
    project: true,
    models: settings.models,
  };
  expect(canSaveWalkthroughWriter(input)).toBe(false);
  expect(canSaveWalkthroughWriter({ ...input, effort: 'high' })).toBe(true);
});
