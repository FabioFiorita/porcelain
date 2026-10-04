import { COMMIT_MESSAGE_BYTES } from '@porcelain/contracts/shared';
import { useMutation } from '@tanstack/react-query';
import type { FormAction } from '../rules/action-form';
import type { ActionInput, GitScope } from '../rules/git-action';
import { expectationFor } from '../rules/feedback';
import type { GitActionStatus } from '../rules/status';
import { useGitAction } from './run-action';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function useActionForm(
  scope: GitScope,
  action: FormAction,
  context: ConnectionContext,
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
  const submit = useMutation({
    mutationFn: (input: ActionInput) =>
      git.run(
        input,
        expectationFor(
          expectedStatus,
          expectedStatus.files?.map((file) => file.path) ?? [],
          undefined,
          true,
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
    messageLimit: COMMIT_MESSAGE_BYTES,
    outcome: git.operation?.receipt,
    busy,
    uncertain,
    error: submit.error ?? look.error ?? recover.error,
    onSubmit: (input: ActionInput) => {
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
