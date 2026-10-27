import { expect, it } from 'vitest';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import {
  confirmedReviewGitSettings,
  reviewGitSettingsBlock,
  reviewGitSettingsSaveMessage,
  reviewGitSettingsView,
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
const offline = new ConnectionError({ message: 'The computer is offline.' });
const missingRoute = new RequestError({
  status: 404,
  message: 'Not Found',
  code: undefined,
});
const unreadable =
  'Reviews & Git settings could not be read from this computer. The computer is offline.';

it.each([
  {
    state: 'still reading',
    read: { confirmed: undefined, failure: undefined },
    view: { kind: 'reading' },
    usable: undefined,
    block: 'Reading Reviews & Git settings for this computer…',
    apart: false,
  },
  {
    state: 'an older computer without the route',
    read: { confirmed: undefined, failure: { error: missingRoute } },
    view: { kind: 'unsupported' },
    usable: undefined,
    block:
      'Update Porcelain on this computer to use its Reviews & Git settings.',
    apart: false,
  },
  {
    state: 'an unreachable computer never read',
    read: { confirmed: undefined, failure: { error: offline } },
    view: { kind: 'unreadable', message: unreadable },
    usable: undefined,
    block: unreadable,
    apart: false,
  },
  {
    state: 'a computer with no settings yet',
    read: { confirmed: { kind: 'unconfigured' }, failure: undefined },
    view: { kind: 'unconfigured' },
    usable: undefined,
    block: 'Choose Reviews & Git settings for this computer in Settings first.',
    apart: false,
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
  },
  {
    state: 'confirmed settings',
    read: { confirmed: configured, failure: undefined },
    view: { ...configured, unreadable: undefined },
    usable: settings,
    block: undefined,
    apart: true,
  },
  {
    state: 'confirmed settings that could not be read again',
    read: { confirmed: configured, failure: { error: offline } },
    view: { ...configured, unreadable },
    usable: undefined,
    block: unreadable,
    apart: true,
  },
] as const)(
  '$state: keeps operations to confirmed settings and explains the rest',
  ({ read, view, usable, block, apart }) => {
    const shown = reviewGitSettingsView(read);
    expect(shown).toEqual(view);
    expect(confirmedReviewGitSettings(shown)).toEqual(usable);
    expect(reviewGitSettingsBlock(shown)).toBe(block);
    expect(specsApart(shown)).toBe(apart);
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
