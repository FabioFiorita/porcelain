import { expect, it } from 'vitest';
import { savedReviewGitSettings } from './review-git-settings.ts';

const imported = {
  pullStrategy: 'merge',
  collapseSpecs: false,
  archiveDeleteWorktree: true,
  archiveDeleteLocalBranch: true,
  archiveDeleteRemoteBranch: true,
} as const;
const configured = {
  kind: 'configured',
  revision: 4,
  settings: imported,
} as const;

it.each([
  {
    case: 'a first import configures revision 1',
    current: { kind: 'unconfigured' },
    save: { kind: 'initialize', settings: imported },
    outcome: {
      kind: 'saved',
      settings: { kind: 'configured', revision: 1, settings: imported },
    },
  },
  {
    case: 'a later import keeps what the computer has',
    current: configured,
    save: {
      kind: 'initialize',
      settings: { ...imported, pullStrategy: 'rebase' },
    },
    outcome: { kind: 'kept', settings: configured },
  },
  {
    case: 'a change keeps every setting it leaves out',
    current: configured,
    save: {
      kind: 'change',
      change: { pullStrategy: 'rebase', archiveDeleteWorktree: false },
    },
    outcome: {
      kind: 'saved',
      settings: {
        kind: 'configured',
        revision: 5,
        settings: {
          ...imported,
          pullStrategy: 'rebase',
          archiveDeleteWorktree: false,
        },
      },
    },
  },
  {
    case: 'a change before any import has nothing to change',
    current: { kind: 'unconfigured' },
    save: { kind: 'change', change: { collapseSpecs: true } },
    outcome: { kind: 'not-configured' },
  },
] as const)('$case', ({ current, save, outcome }) => {
  expect(savedReviewGitSettings(current, save)).toEqual(outcome);
});
