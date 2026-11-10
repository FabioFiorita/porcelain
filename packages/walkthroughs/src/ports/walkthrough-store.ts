import { Context, type Effect } from 'effect';
import type {
  EvidenceAsset,
  WalkthroughJob,
  WalkthroughSettings,
  WalkthroughRun,
} from '../models/walkthrough.ts';
export interface WalkthroughStore {
  readSettings(projectId: string): Effect.Effect<WalkthroughSettings>;
  saveSettings(
    projectId: string,
    settings: WalkthroughSettings,
  ): Effect.Effect<void>;
  cachePullRequests(
    projectId: string,
    pulls: readonly { branch: string; title: string }[],
  ): Effect.Effect<void>;
  readTitles(
    projectId: string,
  ): Effect.Effect<readonly { branch: string; title: string }[]>;
  accept(
    job: WalkthroughJob,
    automaticKey?: string,
  ): Effect.Effect<WalkthroughRun>;
  read(worktreeId: string): Effect.Effect<WalkthroughRun | undefined>;
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
