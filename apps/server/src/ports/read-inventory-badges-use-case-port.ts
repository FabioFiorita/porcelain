import type { Effect } from 'effect';
import type { ReviewBadges } from '@porcelain/kernel/models';
import type { ProjectWorktrees } from '@porcelain/projects/models';

export type ReadInventoryBadgesInput = {
  listings: readonly ProjectWorktrees[];
};

export interface ReadInventoryBadgesUseCasePort {
  execute(input: ReadInventoryBadgesInput): Effect.Effect<ReviewBadges>;
}
