import type {
  ConfiguredReviewGitSettings,
  ReviewGitSettingsSnapshot,
  SaveReviewGitSettings,
} from '../models/review-git-settings.ts';

export type ReviewGitSettingsOutcome =
  | { kind: 'saved'; settings: ConfiguredReviewGitSettings }
  | { kind: 'kept'; settings: ConfiguredReviewGitSettings }
  | { kind: 'not-configured' };

export function savedReviewGitSettings(
  current: ReviewGitSettingsSnapshot,
  save: SaveReviewGitSettings,
): ReviewGitSettingsOutcome {
  if (current.kind === 'configured' && save.kind === 'initialize')
    return { kind: 'kept', settings: current };
  if (save.kind === 'initialize')
    return {
      kind: 'saved',
      settings: { kind: 'configured', revision: 1, settings: save.settings },
    };
  if (current.kind === 'unconfigured') return { kind: 'not-configured' };
  return {
    kind: 'saved',
    settings: {
      kind: 'configured',
      revision: current.revision + 1,
      settings: { ...current.settings, ...save.change },
    },
  };
}
