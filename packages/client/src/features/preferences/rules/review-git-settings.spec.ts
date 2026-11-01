import { expect, it } from 'vitest';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import {
  confirmedReviewGitSettings,
  defaultReviewGitSettings,
  reviewGitPullStrategy,
  reviewGitSettingsBlock,
  reviewGitSettingsImportKept,
  reviewGitSettingsKeptMessage,
  reviewGitSettingsSaveMessage,
  reviewGitSettingsTrustBlock,
  reviewGitSettingsView,
  shownReviewGitSettings,
  specsApart,
} from './review-git-settings.ts';

const settings = {
  pullStrategy: 'rebase',
  collapseSpecs: true,
  archiveDeleteWorktree: false,
  archiveDeleteLocalBranch: true,
  archiveDeleteRemoteBranch: true,
} as const;
const configured = { kind: 'configured', revision: 3, settings } as const;
const candidate = {
  pullStrategy: 'merge',
  collapseSpecs: false,
  archiveDeleteWorktree: true,
  archiveDeleteLocalBranch: false,
  archiveDeleteRemoteBranch: false,
} as const;
const offline = new ConnectionError({ message: 'The computer is offline.' });
const missingRoute = new RequestError({
  status: 404,
  message: 'Not Found',
  code: undefined,
});
const unreadable =
  'Reviews & Git settings could not be read. The computer is offline.';

it('allows first-use Pull with merge and honors a configured strategy only while readable', () => {
  expect(defaultReviewGitSettings).toEqual({
    pullStrategy: 'merge',
    collapseSpecs: false,
    archiveDeleteWorktree: true,
    archiveDeleteLocalBranch: true,
    archiveDeleteRemoteBranch: true,
  });
  expect({
    firstUse: reviewGitPullStrategy({ kind: 'unconfigured' }),
    configured: reviewGitPullStrategy({ ...configured, unreadable: undefined }),
    offline: reviewGitPullStrategy({ ...configured, unreadable }),
  }).toEqual({ firstUse: 'merge', configured: 'rebase', offline: undefined });
});

it.each([
  {
    state: 'still reading',
    read: { confirmed: undefined, failure: undefined },
    view: { kind: 'reading' },
    usable: undefined,
    block: 'Reading Reviews & Git settings for this computer…',
    apart: false,
    shown: undefined,
  },
  {
    state: 'an older computer without the route',
    read: { confirmed: undefined, failure: { error: missingRoute } },
    view: { kind: 'unsupported' },
    usable: undefined,
    block:
      'Update Porcelain on this computer to use its Reviews & Git settings.',
    apart: false,
    shown: undefined,
  },
  {
    state: 'an unreachable computer never read',
    read: { confirmed: undefined, failure: { error: offline } },
    view: { kind: 'unreadable', message: unreadable },
    usable: undefined,
    block: unreadable,
    apart: false,
    shown: undefined,
  },
  {
    state: 'a computer with no settings yet',
    read: { confirmed: { kind: 'unconfigured' }, failure: undefined },
    view: { kind: 'unconfigured' },
    usable: undefined,
    block: 'Choose Reviews & Git settings for this computer in Settings first.',
    apart: false,
    shown: candidate,
  },
  {
    state: 'an unconfigured computer that stopped answering',
    read: {
      confirmed: { kind: 'unconfigured' },
      failure: { error: offline },
    },
    view: { kind: 'unreadable', message: unreadable },
    usable: undefined,
    block: unreadable,
    apart: false,
    shown: undefined,
  },
  {
    state: 'confirmed settings',
    read: { confirmed: configured, failure: undefined },
    view: { ...configured, unreadable: undefined },
    usable: settings,
    block: undefined,
    apart: true,
    shown: settings,
  },
  {
    state: 'confirmed settings that could not be read again',
    read: { confirmed: configured, failure: { error: offline } },
    view: { ...configured, unreadable },
    usable: undefined,
    block: unreadable,
    apart: true,
    shown: settings,
  },
] as const)(
  '$state: keeps operations to confirmed settings and explains the rest',
  ({ read, view, usable, block, apart, shown }) => {
    const computed = reviewGitSettingsView(read);
    expect(computed).toEqual(view);
    expect(confirmedReviewGitSettings(computed)).toEqual(usable);
    expect(reviewGitSettingsBlock(computed)).toBe(block);
    expect(specsApart(computed)).toBe(apart);
    expect(shownReviewGitSettings(computed, candidate)).toEqual(shown);
  },
);

it('explains a refused save with the computer’s reason', () => {
  expect(
    reviewGitSettingsSaveMessage(
      new Error(
        'An owner must trust this device on the computer that runs Porcelain before it can change Reviews & Git settings',
      ),
    ),
  ).toBe(
    'An owner must trust this device on the computer that runs Porcelain before it can change Reviews & Git settings',
  );
  expect(reviewGitSettingsSaveMessage(undefined)).toBe(
    'Reviews & Git settings could not be saved. Try again.',
  );
});

it.each([
  { state: 'the computer took this import', answer: candidate, kept: false },
  {
    state: 'the computer already had other settings',
    answer: { ...candidate, collapseSpecs: true },
    kept: true,
  },
  {
    state: 'the computer kept another device’s import',
    answer: settings,
    kept: true,
  },
] as const)('$state: says whether the import was used', ({ answer, kept }) => {
  expect(reviewGitSettingsImportKept(candidate, answer)).toBe(kept);
});

it('names the computer that kept its own settings', () => {
  expect(reviewGitSettingsKeptMessage('This computer')).toBe(
    'This computer already had settings; yours weren’t used.',
  );
  expect(reviewGitSettingsKeptMessage('Studio Mac')).toBe(
    'Studio Mac already had settings; yours weren’t used.',
  );
});

it.each([
  { state: 'a device the computer trusts', canChange: true, block: undefined },
  {
    state: 'trust not known yet or its refresh failed',
    canChange: undefined,
    block:
      'Device trust could not be confirmed. Check again before changing Reviews & Git settings.',
  },
  {
    state: 'a device the computer does not trust',
    canChange: false,
    block:
      'An owner must trust this device on the computer that runs Porcelain before it can change Reviews & Git settings.',
  },
] as const)('$state: explains why it cannot import', ({ canChange, block }) => {
  expect(reviewGitSettingsTrustBlock(canChange)).toBe(block);
});
