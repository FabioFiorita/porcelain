import { expect, it } from 'vitest';
import {
  generalSettingsSummary,
  reviewsGitSettingsSummary,
} from './settings-summary.ts';

it.each([
  ['system', 'wrap', 'System theme · Wrap long lines'],
  ['light', 'scroll', 'Light theme · Scroll long lines'],
  ['dark', 'wrap', 'Dark theme · Wrap long lines'],
] as const)(
  'summarizes General for %s and %s',
  (appearance, lineOverflow, summary) => {
    expect(generalSettingsSummary({ appearance, lineOverflow })).toBe(summary);
  },
);

const keepAll = {
  archiveDeleteWorktree: false,
  archiveDeleteLocalBranch: false,
  archiveDeleteRemoteBranch: false,
};

it.each([
  [
    { pullStrategy: 'merge', ...keepAll },
    'Merge on pull · Archive keeps everything',
  ],
  [
    { pullStrategy: 'rebase', ...keepAll, archiveDeleteRemoteBranch: true },
    'Rebase on pull · Archive cleans up',
  ],
  [
    {
      pullStrategy: 'merge',
      archiveDeleteWorktree: true,
      archiveDeleteLocalBranch: true,
      archiveDeleteRemoteBranch: true,
    },
    'Merge on pull · Archive cleans up',
  ],
] as const)('summarizes Reviews & Git for %j', (preferences, summary) => {
  expect(reviewsGitSettingsSummary(preferences)).toBe(summary);
});
