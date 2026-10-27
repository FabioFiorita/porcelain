import type { Effect } from 'effect';
import { Context } from 'effect';
import type {
  ConfiguredReviewGitSettings,
  ReviewGitSettingsSnapshot,
} from '../models/review-git-settings.ts';

export interface ReviewGitSettingsStore {
  read(): Effect.Effect<ReviewGitSettingsSnapshot>;
  write(input: ConfiguredReviewGitSettings): Effect.Effect<void>;
}

export const ReviewGitSettingsStore = Context.Service<
  '@porcelain/access/ReviewGitSettingsStore',
  ReviewGitSettingsStore
>('@porcelain/access/ReviewGitSettingsStore');
