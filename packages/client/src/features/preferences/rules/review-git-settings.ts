import type {
  ReadReviewGitSettingsResponse,
  ReviewGitSettings,
} from '@porcelain/contracts/access';

export type ReviewGitSettingsView =
  | { kind: 'reading' }
  | { kind: 'unsupported' }
  | { kind: 'unreadable'; message: string }
  | { kind: 'unconfigured' }
  | {
      kind: 'configured';
      settings: ReviewGitSettings;
      revision: number;
      unreadable: string | undefined;
    };

const UNREADABLE = 'Reviews & Git settings could not be read.';

function failureMessage(error: unknown): string {
  return error instanceof Error &&
    (error.name === 'ConnectionError' || error.name === 'RequestError')
    ? `${UNREADABLE} ${error.message}`
    : UNREADABLE;
}

function olderServer(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'RequestError' &&
    'status' in error &&
    error.status === 404
  );
}

export function reviewGitSettingsView(read: {
  confirmed: ReadReviewGitSettingsResponse | undefined;
  failure: { error: unknown } | undefined;
}): ReviewGitSettingsView {
  const { confirmed, failure } = read;
  if (confirmed === undefined) {
    if (failure === undefined) return { kind: 'reading' };
    if (olderServer(failure.error)) return { kind: 'unsupported' };
    return { kind: 'unreadable', message: failureMessage(failure.error) };
  }
  if (confirmed.kind === 'unconfigured') {
    if (failure !== undefined)
      return { kind: 'unreadable', message: failureMessage(failure.error) };
    return { kind: 'unconfigured' };
  }
  return {
    kind: 'configured',
    settings: confirmed.settings,
    revision: confirmed.revision,
    unreadable:
      failure === undefined ? undefined : failureMessage(failure.error),
  };
}

export function confirmedReviewGitSettings(
  view: ReviewGitSettingsView,
): ReviewGitSettings | undefined {
  return view.kind === 'configured' && view.unreadable === undefined
    ? view.settings
    : undefined;
}

export function shownReviewGitSettings(
  view: ReviewGitSettingsView,
  importCandidate: ReviewGitSettings,
): ReviewGitSettings | undefined {
  switch (view.kind) {
    case 'configured':
      return view.settings;
    case 'unconfigured':
      return importCandidate;
    case 'reading':
    case 'unsupported':
    case 'unreadable':
      return undefined;
  }
}

export function reviewGitSettingsImportKept(
  sent: ReviewGitSettings,
  answer: ReviewGitSettings,
): boolean {
  return (
    sent.pullStrategy !== answer.pullStrategy ||
    sent.collapseSpecs !== answer.collapseSpecs ||
    sent.archiveDeleteWorktree !== answer.archiveDeleteWorktree ||
    sent.archiveDeleteLocalBranch !== answer.archiveDeleteLocalBranch ||
    sent.archiveDeleteRemoteBranch !== answer.archiveDeleteRemoteBranch
  );
}

export function reviewGitSettingsKeptMessage(computer: string): string {
  return `${computer} already had settings; yours weren’t used.`;
}

export function reviewGitSettingsTrustBlock(
  canChange: boolean | undefined,
): string | undefined {
  if (canChange === undefined)
    return 'Device trust could not be confirmed. Check again before changing Reviews & Git settings.';
  return canChange
    ? undefined
    : 'An owner must trust this device on the computer that runs Porcelain before it can change Reviews & Git settings.';
}

export function specsApart(view: ReviewGitSettingsView): boolean {
  return view.kind === 'configured' && view.settings.collapseSpecs;
}

export function reviewGitSettingsBlock(
  view: ReviewGitSettingsView,
): string | undefined {
  switch (view.kind) {
    case 'reading':
      return 'Reading Reviews & Git settings for this computer…';
    case 'unsupported':
      return 'Update Porcelain on this computer to use its Reviews & Git settings.';
    case 'unreadable':
      return view.message;
    case 'unconfigured':
      return 'Choose Reviews & Git settings for this computer in Settings first.';
    case 'configured':
      return view.unreadable;
  }
}

export function reviewGitSettingsSaveMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : 'Reviews & Git settings could not be saved. Try again.';
}
