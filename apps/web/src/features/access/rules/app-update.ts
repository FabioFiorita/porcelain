import type { DesktopAppUpdateState } from '@porcelain/contracts/desktop';

export type AppUpdateState = DesktopAppUpdateState;

export function appUpdateProgress(state: AppUpdateState): string | undefined {
  switch (state.status) {
    case 'checking':
      return 'Checking for a new version…';
    case 'downloading':
      return `Downloading ${state.version}…`;
    case 'verifying':
      return `Verifying ${state.version}…`;
    case 'ready':
      return `${state.version} is ready; the app restarts to finish.`;
    case 'installing':
      return `Installing ${state.version}; the app restarts in a moment.`;
    default:
      return undefined;
  }
}

export function noUpdateMessage(state: AppUpdateState): string {
  return state.status === 'unavailable'
    ? 'This build updates by reinstalling; there is no update feed yet.'
    : 'This is the newest version of the app.';
}
