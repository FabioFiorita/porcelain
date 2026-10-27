import { Effect } from 'effect';
import type {
  ConfiguredReviewGitSettings,
  ReviewGitSettingsSnapshot,
} from '../../src/models/review-git-settings.ts';
import type { ReviewGitSettingsStore } from '../../src/ports/review-git-settings-store.ts';

export class InMemoryReviewGitSettingsStore implements ReviewGitSettingsStore {
  private snapshot: ReviewGitSettingsSnapshot = { kind: 'unconfigured' };

  read(): Effect.Effect<ReviewGitSettingsSnapshot> {
    return Effect.sync(() => structuredClone(this.snapshot));
  }

  write(input: ConfiguredReviewGitSettings): Effect.Effect<void> {
    return Effect.sync(() => {
      this.snapshot = structuredClone(input);
    });
  }
}
