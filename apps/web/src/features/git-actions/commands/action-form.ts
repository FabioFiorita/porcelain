import { COMMIT_MESSAGE_BYTES } from '@porcelain/contracts/shared';
import { useMutation } from '@tanstack/react-query';
import type { GitContext } from '../api';
import type { FormAction } from '../rules/action-form';
import type { ActionInput, GitScope } from '../rules/git-action';
import { expectationFor } from '../rules/feedback';
import type { GitActionStatus } from '../rules/status';
import { useGitAction } from './run-action';

export function useActionForm(
  scope: GitScope,
  action: FormAction,
  context: GitContext,
  {
    expectedStatus,
    onBusy,
    onLookAgain,
  }: {
    expectedStatus: GitActionStatus;
    onBusy: (busy: boolean) => void;
    onLookAgain?: (() => Promise<void>) | undefined;
  },
) {
  const git = useGitAction(scope, action, context);
  const remote = action === 'push' || action === 'pull' || action === 'fetch';
  const stash = action.startsWith('stash-');
  const submit = useMutation({
    mutationFn: (input: ActionInput) =>
      git.run(
        input,
        expectationFor(
          expectedStatus,
          stash ? (expectedStatus.files?.map((file) => file.path) ?? []) : [],
          remote ? (expectedStatus.branch?.upstreamOid ?? null) : undefined,
          stash,
        ),
      ),
    onSettled: () => onBusy(false),
  });
  const look = useMutation({
    mutationFn: async (lookAgain: () => Promise<void>) => {
      await lookAgain();
      git.startNew();
    },
  });
  const recover = useMutation({ mutationFn: () => git.recover.submit() });
  const busy = submit.isPending || look.isPending;
  const uncertain = Boolean(git.operation && !git.canStartNew);
  return {
    operation: git.operation,
    remote,
    messageLimit: COMMIT_MESSAGE_BYTES,
    outcome: git.operation?.receipt,
    busy,
    uncertain,
    error: submit.error ?? look.error ?? recover.error,
    submit: (input: ActionInput) => {
      if (busy || uncertain) return;
      onBusy(true);
      look.reset();
      recover.reset();
      submit.mutate(input);
    },
    lookAgain: () => {
      if (!onLookAgain) return;
      submit.reset();
      recover.reset();
      look.mutate(onLookAgain);
    },
    checkOutcome: () => {
      submit.reset();
      look.reset();
      recover.mutate();
    },
  };
}
