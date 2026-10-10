import { describe, expect, it } from 'vitest';
import { appUpdateProgress, noUpdateMessage } from './app-update.ts';

describe('appUpdateProgress', () => {
  it.each([
    [{ status: 'checking' as const }, 'Checking for a new version…'],
    [
      { status: 'downloading' as const, version: '2.0.0' },
      'Downloading 2.0.0…',
    ],
    [
      { status: 'ready' as const, version: '2.0.0' },
      '2.0.0 is ready; the app restarts to finish.',
    ],
    [
      { status: 'installing' as const, version: '2.0.0' },
      'Installing 2.0.0; the app restarts in a moment.',
    ],
  ])('describes %j as %j', (state, text) => {
    expect(appUpdateProgress(state)).toBe(text);
  });

  it.each([
    [{ status: 'idle' as const }],
    [{ status: 'unavailable' as const }],
    [{ status: 'available' as const, version: '2.0.0' }],
    [{ status: 'error' as const, message: 'No release feed' }],
  ])('shows no progress for %j', (state) => {
    expect(appUpdateProgress(state)).toBeUndefined();
  });
});

describe('noUpdateMessage', () => {
  it('says a build without an update feed updates by reinstalling, rather than claiming it is the newest', () => {
    expect(noUpdateMessage({ status: 'unavailable' })).toBe(
      'This build updates by reinstalling; there is no update feed yet.',
    );
  });

  it('says the app is the newest version when its update feed offers nothing newer', () => {
    expect(noUpdateMessage({ status: 'idle' })).toBe(
      'This is the newest version of the app.',
    );
  });
});
