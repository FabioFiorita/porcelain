import { Context, type Effect } from 'effect';
import type {
  WalkthroughSettings,
  WalkthroughRun,
  WalkthroughWriterChoice,
} from '../models/walkthrough.ts';
export interface WalkthroughInventoryReader {
  readonly readProject: (input: {
    projectId: string;
    worktreeIds: readonly string[];
  }) => Effect.Effect<{
    settings: WalkthroughSettings;
    titles: readonly { branch: string; title: string }[];
    runs: readonly (WalkthroughRun | undefined)[];
  }>;
  readonly readDefaultWriter: () => Effect.Effect<
    WalkthroughWriterChoice | undefined
  >;
}
export const WalkthroughInventoryReader = Context.Service<
  '@porcelain/walkthroughs/WalkthroughInventoryReader',
  WalkthroughInventoryReader
>('@porcelain/walkthroughs/WalkthroughInventoryReader');
