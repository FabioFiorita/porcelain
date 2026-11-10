import { Context, type Effect } from 'effect';
import type {
  EvidenceAsset,
  WalkthroughFailure,
  WalkthroughJob,
  WalkthroughRun,
} from '../models/walkthrough.ts';
import type {
  AnswerState,
  StoredWalkthroughMessage,
} from '../models/conversation.ts';
export interface WalkthroughStore {
  accept(job: WalkthroughJob): Effect.Effect<WalkthroughRun>;
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
  readJob(runId: string): Effect.Effect<WalkthroughJob | undefined>;
  listReadyRuns(worktreeId: string): Effect.Effect<readonly WalkthroughRun[]>;
  addMessage(message: StoredWalkthroughMessage): Effect.Effect<void>;
  readMessage(
    worktreeId: string,
    messageId: string,
  ): Effect.Effect<StoredWalkthroughMessage | undefined>;
  listMessages(
    worktreeId: string,
  ): Effect.Effect<readonly StoredWalkthroughMessage[]>;
  readOldestAnswering(): Effect.Effect<StoredWalkthroughMessage | undefined>;
  settleAnswer(
    messageId: string,
    answer: Exclude<AnswerState, { status: 'answering' }>,
  ): Effect.Effect<void>;
  failAnswering(failure: WalkthroughFailure): Effect.Effect<readonly string[]>;
  requeueAnswer(worktreeId: string, messageId: string): Effect.Effect<boolean>;
  saveForLater(
    worktreeId: string,
    messageId: string,
    saved: boolean,
  ): Effect.Effect<void>;
  markPosted(
    worktreeId: string,
    messageIds: readonly string[],
    url: string,
    postedAt: string,
  ): Effect.Effect<void>;
}
export const WalkthroughStore = Context.Service<
  '@porcelain/walkthroughs/WalkthroughStore',
  WalkthroughStore
>('@porcelain/walkthroughs/WalkthroughStore');
