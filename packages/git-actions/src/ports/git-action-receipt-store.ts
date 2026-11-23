import type { Effect } from 'effect';
import { Context } from 'effect';
import { type WorktreeKey } from '@porcelain/kernel/models';
import {
  type FinishedGitAction,
  type GitActionReceipt,
  type GitActionReceiptKey,
  type GitActionReceiptRemoval,
} from '../models/git-action-receipt.ts';

export interface GitActionReceiptStore {
  read(input: GitActionReceiptKey): Effect.Effect<GitActionReceipt | undefined>;
  accept(
    input: GitActionReceipt,
  ): Effect.Effect<
    { kind: 'inserted' } | { kind: 'existing'; receipt: GitActionReceipt }
  >;
  claimExecution(input: GitActionReceiptKey): Effect.Effect<boolean>;
  save(input: GitActionReceipt): Effect.Effect<void>;
  running(): Effect.Effect<GitActionReceipt[]>;
  latestInterrupted(
    input: WorktreeKey,
  ): Effect.Effect<GitActionReceipt | undefined>;
  finished(): Effect.Effect<FinishedGitAction[]>;
  remove(input: GitActionReceiptRemoval): Effect.Effect<void>;
}

export const GitActionReceiptStore = Context.Service<
  '@porcelain/git-actions/GitActionReceiptStore',
  GitActionReceiptStore
>('@porcelain/git-actions/GitActionReceiptStore');
