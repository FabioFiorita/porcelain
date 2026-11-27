import { expect, it } from 'vite-plus/test';
import {
  canSaveWalkthroughWriter,
  chooseWalkthroughWriter,
  isProjectDefaultWriter,
  walkthroughEfforts,
  walkthroughWriterMenu,
  walkthroughWriterNotice,
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

it('shows the effort reason once when the run already reported it', () => {
  const check = {
    failed: false,
    noWriters: false,
    status: walkthroughWriterStatus({
      ...settings,
      availability: 'unsupported-effort',
    }),
  };
  expect(walkthroughWriterNotice(check)).toBe(
    "Opus 5.5 doesn't support high effort.",
  );
  expect(
    walkthroughWriterNotice(
      check,
      "Opus 5.5 doesn't support high effort. Choose a supported effort in walkthrough settings.",
    ),
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

const codexModels: WriterSettings['models'] = [
  {
    provider: 'codex',
    model: 'gpt-6.2-sol',
    label: 'GPT-6.2-Sol',
    family: 'Sol',
    efforts: ['low', 'medium', 'high'],
    defaultEffort: 'low',
  },
  {
    provider: 'codex',
    model: 'gpt-6.1-sol',
    label: 'GPT-6.1-Sol',
    family: 'Sol',
    efforts: ['low', 'medium', 'high', 'xhigh'],
    defaultEffort: 'low',
  },
  {
    provider: 'codex',
    model: 'house-model',
    label: 'House model',
    efforts: ['medium'],
    defaultEffort: 'medium',
  },
];

it('offers the newest model of each family and every exact model', () => {
  expect(walkthroughWriterMenu([...settings.models, ...codexModels])).toEqual([
    {
      provider: 'claude',
      label: 'Claude',
      latest: [],
      exact: [{ key: 'claude:claude-opus-5-5', label: 'Opus 5.5' }],
    },
    {
      provider: 'codex',
      label: 'Codex',
      latest: [
        {
          key: 'codex:gpt-6.2-sol:Sol',
          label: 'Latest Sol',
          model: 'GPT-6.2-Sol',
        },
      ],
      exact: [
        { key: 'codex:gpt-6.2-sol', label: 'GPT-6.2-Sol' },
        { key: 'codex:gpt-6.1-sol', label: 'GPT-6.1-Sol' },
        { key: 'codex:house-model', label: 'House model' },
      ],
    },
  ]);
});

it('keeps the effort when the chosen model supports it and follows the family when latest is chosen', () => {
  const current = {
    provider: 'codex',
    model: 'gpt-6.1-sol',
    effort: 'high',
  } as const;
  expect(
    chooseWalkthroughWriter('codex:gpt-6.2-sol:Sol', current, codexModels),
  ).toEqual({
    provider: 'codex',
    model: 'gpt-6.2-sol',
    effort: 'high',
    latest: 'Sol',
  });
  expect(
    chooseWalkthroughWriter('codex:house-model', current, codexModels),
  ).toEqual({ provider: 'codex', model: 'house-model', effort: 'medium' });
});

it('calls the chosen writer the project default only when the saved family and effort match', () => {
  const chosen = {
    provider: 'codex',
    model: 'gpt-6.2-sol',
    effort: 'high',
    latest: 'Sol',
  } as const;
  const saved = {
    provider: 'codex',
    model: 'gpt-6.1-sol',
    effort: 'high',
    latest: 'Sol',
  } as const;
  expect(isProjectDefaultWriter(saved, chosen, codexModels)).toBe(true);
  expect(
    isProjectDefaultWriter({ ...saved, effort: 'low' }, chosen, codexModels),
  ).toBe(false);
  expect(
    isProjectDefaultWriter(
      { provider: 'codex', model: 'gpt-6.1-sol', effort: 'high' },
      chosen,
      codexModels,
    ),
  ).toBe(false);
  expect(isProjectDefaultWriter(undefined, chosen, codexModels)).toBe(false);
});

it('offers the efforts of the chosen exact model and none for an unknown one', () => {
  expect(
    walkthroughEfforts(
      { provider: 'codex', model: 'gpt-6.1-sol' },
      codexModels,
    ),
  ).toEqual(['low', 'medium', 'high', 'xhigh']);
  expect(
    walkthroughEfforts({ provider: 'codex', model: 'gone' }, codexModels),
  ).toEqual([]);
});
