import { useForm, useSelector } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import type { GitContext } from '../api';
import type { GitScope } from '../rules/git-action';
import type { GitActionStatus } from '../rules/status';
import {
  expectationFor,
  gitErrorMessage,
  receiptFailed,
  receiptWords,
} from '../rules/feedback';
import { useBranches } from '../queries/git-actions';
import { useGitAction } from './run-action';

export function useBranchForm(
  scope: GitScope,
  mode: 'switch' | 'create',
  status: GitActionStatus,
  context: GitContext,
  close: () => void,
) {
  const action = mode === 'switch' ? 'switch-branch' : 'create-branch';
  const git = useGitAction(scope, action, context);
  const branches = useBranches(scope, context);
  const current = branches.data?.current ?? null;
  const lookedBranch =
    status.branch?.name?.replace(/^refs\/heads\//, '') ?? null;
  const aligned =
    mode === 'create' ||
    (branches.data !== undefined && current === lookedBranch);
  const form = useForm({ defaultValues: { branch: '', switchTo: true } });
  const { branch, switchTo } = useSelector(form.store, (state) => state.values);
  const choices = branches.data?.branches ?? [];
  const uncertain = Boolean(git.operation && !git.canStartNew);
  const submit = useMutation({
    mutationFn: async () => {
      const name = form.state.values.branch.trim();
      if (!name || uncertain || !aligned) return;
      const receipt = await git.run(
        mode === 'switch'
          ? { action: 'switch-branch', branch: name }
          : {
              action: 'create-branch',
              branch: name,
              switchTo: form.state.values.switchTo,
            },
        expectationFor(status),
      );
      if (receiptFailed(receipt)) {
        if (mode === 'switch') void branches.refetch();
        throw new Error(receiptWords(receipt));
      }
      close();
    },
  });
  const recover = useMutation({
    mutationFn: async () => {
      const receipt = await git.recover.submit();
      if (receiptFailed(receipt)) throw new Error(receiptWords(receipt));
      close();
    },
  });
  const busy = submit.isPending || recover.isPending;
  return {
    branch,
    switchTo,
    branches,
    current,
    lookedBranch,
    aligned,
    choices,
    uncertain,
    busy,
    git,
    error:
      submit.error || recover.error
        ? gitErrorMessage(submit.error ?? recover.error)
        : null,
    setBranch: (value: string) => form.setFieldValue('branch', value),
    setSwitchTo: (value: boolean) => form.setFieldValue('switchTo', value),
    submit: () => {
      if (busy) return;
      submit.reset();
      recover.reset();
      submit.mutate();
    },
    checkOutcome: () => {
      if (busy) return;
      submit.reset();
      recover.reset();
      recover.mutate();
    },
    close: () => {
      if (!busy) close();
    },
  };
}
