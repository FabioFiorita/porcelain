import { Effect, Context, Layer } from 'effect';
import { Clock } from '@porcelain/kernel/ports';
import { DiscardExpectationMismatchError } from '../errors/discard-expectation-mismatch-error.ts';
import { DuplicateExpectedFileError } from '../errors/duplicate-expected-file-error.ts';
import { EmptyCommitSelectionError } from '../errors/empty-commit-selection-error.ts';
import { ExpectedFilesMismatchError } from '../errors/expected-files-mismatch-error.ts';
import { GitActionReceiptMismatchError } from '../errors/git-action-receipt-mismatch-error.ts';
import { InvalidHunkRangeError } from '../errors/invalid-hunk-range-error.ts';
import { MergeExpectationMismatchError } from '../errors/merge-expectation-mismatch-error.ts';
import { MissingExpectedFilesError } from '../errors/missing-expected-files-error.ts';
import { MissingUpstreamExpectationError } from '../errors/missing-upstream-expectation-error.ts';
import {
  type AcceptGitActionInput,
  type AcceptGitActionResult,
} from '../models/accept-git-action.ts';
import { type GitActionProblem } from '../models/git-action-problem.ts';
import { type GitActionReceipt } from '../models/git-action-receipt.ts';
import { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionProblem } from '../rules/git-action-problem.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';
import { gitActionTarget } from '../rules/git-action-target.ts';
import { sameGitActionRequest } from '../rules/same-git-action-request.ts';

export class AcceptGitActionService extends Context.Service<
  AcceptGitActionService,
  {
    readonly execute: (
      input: AcceptGitActionInput,
    ) => Effect.Effect<
      AcceptGitActionResult,
      | GitActionReceiptMismatchError
      | InvalidHunkRangeError
      | DuplicateExpectedFileError
      | MergeExpectationMismatchError
      | EmptyCommitSelectionError
      | MissingExpectedFilesError
      | ExpectedFilesMismatchError
      | DiscardExpectationMismatchError
      | MissingUpstreamExpectationError,
      never
    >;
  }
>()('@porcelain/git-actions/AcceptGitActionService') {
  static readonly layer = Layer.effect(
    AcceptGitActionService,
    Effect.gen(function* () {
      const gitActionReceiptsCapability = yield* GitActionReceiptStore;
      const clockCapability = yield* Clock;
      function operationFailure(
        problem: GitActionProblem,
      ):
        | GitActionReceiptMismatchError
        | InvalidHunkRangeError
        | DuplicateExpectedFileError
        | MergeExpectationMismatchError
        | EmptyCommitSelectionError
        | MissingExpectedFilesError
        | ExpectedFilesMismatchError
        | DiscardExpectationMismatchError
        | MissingUpstreamExpectationError {
        switch (problem.kind) {
          case 'hunk-range':
            return new InvalidHunkRangeError();
          case 'duplicate-expected-file':
            return new DuplicateExpectedFileError();
          case 'merge-expectation':
            return new MergeExpectationMismatchError();
          case 'empty-commit-selection':
            return new EmptyCommitSelectionError();
          case 'missing-expected-files':
            return new MissingExpectedFilesError();
          case 'expected-files-mismatch':
            return new ExpectedFilesMismatchError();
          case 'discard-expectation':
            return new DiscardExpectationMismatchError();
          case 'missing-upstream-expectation':
            return new MissingUpstreamExpectationError();
        }
      }
      return {
        execute: Effect.fn('AcceptGitActionService.execute')(function* (
          input: AcceptGitActionInput,
        ): Effect.fn.Return<
          AcceptGitActionResult,
          | GitActionReceiptMismatchError
          | InvalidHunkRangeError
          | DuplicateExpectedFileError
          | MergeExpectationMismatchError
          | EmptyCommitSelectionError
          | MissingExpectedFilesError
          | ExpectedFilesMismatchError
          | DiscardExpectationMismatchError
          | MissingUpstreamExpectationError,
          never
        > {
          const { intent, expected } = input;
          const problem = gitActionProblem(intent, expected);
          if (problem) return yield* Effect.fail(operationFailure(problem));
          const previous = gitActionReceiptsCapability.read({
            requestId: input.requestId,
          });
          if (previous) {
            if (!sameGitActionRequest(previous, input))
              return yield* Effect.fail(new GitActionReceiptMismatchError());
            return {
              kind: 'repeated',
              receipt: gitActionReceiptView(previous),
            };
          }
          const receipt: GitActionReceipt = {
            requestId: input.requestId,
            projectId: input.projectId,
            worktreeId: input.worktreeId,
            action: intent.action,
            intent,
            expected,
            state: 'running',
            progress: [],
            refreshRequired: false,
            acceptedAt: clockCapability.now(),
          };
          gitActionReceiptsCapability.insert(receipt);
          return {
            kind: 'accepted',
            receipt: gitActionReceiptView(receipt),
            run: {
              requestId: input.requestId,
              projectId: input.projectId,
              worktreeId: input.worktreeId,
              intent,
              expected,
              target: gitActionTarget(intent, expected),
            },
          };
        }),
      };
    }),
  );
}
