import { GenerateCommitDraftOptions } from '../ports/generate-commit-draft-options.ts';
import { Effect, Context, Layer } from 'effect';
import { CommitGenerationFailedError } from '../errors/commit-generation-failed-error.ts';
import { CommitGroupsMismatchError } from '../errors/commit-groups-mismatch-error.ts';
import { CommitToolFailedError } from '../errors/commit-tool-failed-error.ts';
import { CommitToolMissingError } from '../errors/commit-tool-missing-error.ts';
import { UnsupportedCommitModelError } from '../errors/unsupported-commit-model-error.ts';
import {
  type CommitDraftGeneration,
  type CommitGroup,
} from '../models/commit-draft.ts';
import {
  type GenerateCommitDraftInput,
  type GenerateCommitDraftResult,
} from '../models/generate-commit-draft.ts';
import { CommitDraftSource } from '../ports/commit-draft-source.ts';
import { commitGroupsCoverSelection } from '../rules/commit-groups-cover-selection.ts';

export class GenerateCommitDraftService extends Context.Service<
  GenerateCommitDraftService,
  {
    readonly execute: (
      input: GenerateCommitDraftInput,
    ) => Effect.Effect<
      GenerateCommitDraftResult,
      | CommitGroupsMismatchError
      | UnsupportedCommitModelError
      | CommitToolMissingError
      | CommitToolFailedError
      | CommitGenerationFailedError,
      never
    >;
  }
>()('@porcelain/git-actions/GenerateCommitDraftService') {
  static readonly layer = Layer.effect(
    GenerateCommitDraftService,
    Effect.gen(function* () {
      const commitDraftSourceCapability = yield* CommitDraftSource;
      const optionsCapability = yield* GenerateCommitDraftOptions;
      const operationDrafted = Effect.fn('GenerateCommitDraftService.drafted')(
        function* (
          generation: CommitDraftGeneration,
        ): Effect.fn.Return<
          CommitGroup[],
          | CommitGroupsMismatchError
          | UnsupportedCommitModelError
          | CommitToolMissingError
          | CommitToolFailedError
          | CommitGenerationFailedError,
          never
        > {
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
        },
      );
      return {
        execute: Effect.fn('GenerateCommitDraftService.execute')(function* (
          input: GenerateCommitDraftInput,
        ): Effect.fn.Return<
          GenerateCommitDraftResult,
          | CommitGroupsMismatchError
          | UnsupportedCommitModelError
          | CommitToolMissingError
          | CommitToolFailedError
          | CommitGenerationFailedError,
          never
        > {
          const { capture } = input;
          const groups = yield* operationDrafted(
            yield* commitDraftSourceCapability.generate({
              mode: input.mode,
              model: input.model,
              paths: capture.paths,
              evidence: capture.evidence,
            }),
          );
          if (
            !commitGroupsCoverSelection(
              groups,
              capture,
              input.mode,
              optionsCapability,
            )
          )
            return yield* Effect.fail(new CommitGroupsMismatchError());
          return { groups, expectedFiles: capture.expectedFiles };
        }),
      };
    }),
  );
}
