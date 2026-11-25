import { Effect, Layer } from 'effect';
import { expect, it } from 'vite-plus/test';
import { PullRequestMergeRefusedError } from '@porcelain/reviews/errors';
import { GitHubPullRequestMerger } from '@porcelain/reviews/ports';
import { MergeGitHubPullRequestService } from '@porcelain/reviews/services';
import {
  ReadProjectGitHubTargetUseCasePort,
  type ProjectGitHubTarget,
} from '../../ports/read-project-github-target-use-case-port.ts';
import { MergePullRequestUseCase } from './merge-pull-request.ts';

const head = '653d8396c7c1b6a503c3096d3f46a0f45cf33ca8';

function subject(
  target: ProjectGitHubTarget,
  refusal?: PullRequestMergeRefusedError,
) {
  const merges: unknown[] = [];
  const layer = MergePullRequestUseCase.layer.pipe(
    Layer.provide(MergeGitHubPullRequestService.layer),
    Layer.provide(
      Layer.succeed(
        GitHubPullRequestMerger,
        GitHubPullRequestMerger.of({
          merge: (input) =>
            Effect.sync(() => merges.push(input)).pipe(
              Effect.andThen(refusal ? Effect.fail(refusal) : Effect.void),
            ),
        }),
      ),
    ),
    Layer.provide(
      Layer.succeed(ReadProjectGitHubTargetUseCasePort, {
        execute: () => Effect.succeed(target),
      }),
    ),
  );
  const merge = (method: 'merge' | 'squash' | 'rebase') =>
    Effect.runPromise(
      MergePullRequestUseCase.use((useCase) =>
        useCase.execute({
          projectId: 'project-1',
          number: 412,
          method,
          headSha: head,
        }),
      ).pipe(Effect.result, Effect.provide(layer)),
    );
  return { merges, merge };
}

const available: ProjectGitHubTarget = {
  kind: 'available',
  repository: { owner: 'example', repo: 'notes' },
  account: 'fixture',
  number: 412,
};

it('merges the pull request on the selected account with the chosen method and the head the developer read', async () => {
  const { merges, merge } = subject(available);
  const result = await merge('squash');
  expect(result).toMatchObject({ _tag: 'Success', success: { merged: true } });
  expect(merges).toEqual([
    {
      owner: 'example',
      repo: 'notes',
      account: 'fixture',
      number: 412,
      method: 'squash',
      headSha: head,
    },
  ]);
});

it('refuses without calling GitHub when the project cannot reach the pull request', async () => {
  const { merges, merge } = subject({
    kind: 'unavailable',
    reason: 'no-accounts',
  });
  const result = await merge('merge');
  expect(merges).toEqual([]);
  expect(result._tag).toBe('Failure');
  if (result._tag === 'Failure')
    expect(result.failure.message).toBe(
      'No GitHub account is signed in. Run gh auth login on this computer.',
    );
});

it('passes GitHub’s refusal through with its reason', async () => {
  const { merge } = subject(
    available,
    new PullRequestMergeRefusedError({
      reason: 'not-mergeable',
      detail: 'At least 1 approving review is required.',
    }),
  );
  const result = await merge('rebase');
  expect(result._tag).toBe('Failure');
  if (result._tag === 'Failure')
    expect(result.failure.message).toBe(
      'GitHub refused the merge: At least 1 approving review is required.',
    );
});
