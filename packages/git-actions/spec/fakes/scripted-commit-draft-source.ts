import { Effect } from 'effect';
import type {
  CommitDraftGeneration,
  CommitDraftRequest,
} from '../../src/models/commit-draft.ts';
import type { CommitDraftSource } from '../../src/ports/commit-draft-source.ts';

export class ScriptedCommitDraftSource implements CommitDraftSource {
  private readonly generations: Readonly<Record<string, CommitDraftGeneration>>;

  constructor(generations: Readonly<Record<string, CommitDraftGeneration>>) {
    this.generations = generations;
  }

  generate(input: CommitDraftRequest): Effect.Effect<CommitDraftGeneration> {
    return Effect.sync(() => {
      return this.generations[input.model] ?? { kind: 'unsupported-model' };
    });
  }
}
