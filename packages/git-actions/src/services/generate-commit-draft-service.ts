import { Effect } from 'effect';
import { CommitGenerationFailedError } from '../errors/commit-generation-failed-error.ts';
import { CommitGroupsMismatchError } from '../errors/commit-groups-mismatch-error.ts';
import { CommitToolFailedError } from '../errors/commit-tool-failed-error.ts';
import { CommitToolMissingError } from '../errors/commit-tool-missing-error.ts';
import { UnsupportedCommitModelError } from '../errors/unsupported-commit-model-error.ts';
import type {
  CommitDraftGeneration,
  CommitGroup,
} from '../models/commit-draft.ts';
import type {
  GenerateCommitDraftInput,
  GenerateCommitDraftOptions,
  GenerateCommitDraftResult,
} from '../models/generate-commit-draft.ts';
import type { CommitDraftSource } from '../ports/commit-draft-source.ts';
import { commitGroupsCoverSelection } from '../rules/commit-groups-cover-selection.ts';

export class GenerateCommitDraftService {
  private readonly commitDraftSource: CommitDraftSource;
  private readonly options: GenerateCommitDraftOptions;

  constructor(
    commitDraftSource: CommitDraftSource,
    options: GenerateCommitDraftOptions,
  ) {
    this.commitDraftSource = commitDraftSource;
    this.options = options;
  }

  execute(
    input: GenerateCommitDraftInput,
  ): Effect.Effect<
    GenerateCommitDraftResult,
    | CommitGroupsMismatchError
    | UnsupportedCommitModelError
    | CommitToolMissingError
    | CommitToolFailedError
    | CommitGenerationFailedError,
    never
  > {
    return Effect.gen({ self: this }, function* () {
      const { capture } = input;
      const groups = yield* this.drafted(
        yield* this.commitDraftSource.generate({
          mode: input.mode,
          model: input.model,
          paths: capture.paths,
          evidence: capture.evidence,
        }),
      );
      if (
        !commitGroupsCoverSelection(groups, capture, input.mode, this.options)
      )
        return yield* Effect.fail(new CommitGroupsMismatchError());
      return { groups, expectedFiles: capture.expectedFiles };
    });
  }

  private drafted(
    generation: CommitDraftGeneration,
  ): Effect.Effect<
    CommitGroup[],
    | CommitGroupsMismatchError
    | UnsupportedCommitModelError
    | CommitToolMissingError
    | CommitToolFailedError
    | CommitGenerationFailedError,
    never
  > {
    return Effect.gen({ self: this }, function* () {
      switch (generation.kind) {
        case 'drafted':
          return generation.groups;
        case 'unsupported-model':
          return yield* Effect.fail(new UnsupportedCommitModelError());
        case 'tool-missing':
          return yield* Effect.fail(new CommitToolMissingError());
        case 'tool-failed':
          return yield* Effect.fail(new CommitToolFailedError());
        case 'failed':
          return yield* Effect.fail(new CommitGenerationFailedError());
      }
    });
  }
}
