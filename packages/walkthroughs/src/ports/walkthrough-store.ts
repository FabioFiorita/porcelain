import { Context, type Effect } from 'effect';
import type {
  EvidenceAsset,
  WalkthroughJob,
  WalkthroughRun,
} from '../models/walkthrough.ts';
export interface WalkthroughStore {
  accept(job: WalkthroughJob): Effect.Effect<WalkthroughRun>;
  read(
    worktreeId: string,
    headOid?: string,
  ): Effect.Effect<WalkthroughRun | undefined>;
  listPending(): Effect.Effect<readonly WalkthroughJob[]>;
  claim(id: string): Effect.Effect<boolean>;
  save(run: WalkthroughRun): Effect.Effect<void>;
  saveAssets(id: string, assets: readonly EvidenceAsset[]): Effect.Effect<void>;
  readAsset(
    id: string,
    assetId: string,
    worktreeId: string,
  ): Effect.Effect<EvidenceAsset | undefined>;
}
export const WalkthroughStore = Context.Service<
  '@porcelain/walkthroughs/WalkthroughStore',
  WalkthroughStore
>('@porcelain/walkthroughs/WalkthroughStore');
