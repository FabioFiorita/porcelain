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
  insert(input: GitActionReceipt): Effect.Effect<void>;
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
