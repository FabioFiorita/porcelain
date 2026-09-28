import type { GitContext } from '../api';
import { useMutation } from '@tanstack/react-query';
import { asMutation } from '@/shared/query/mutation';
import type {
  CommitDraft,
  CommitDraftInput,
  GitScope,
} from '../rules/git-action';

export function useCommitDraft(
  scope: GitScope,
  context: GitContext,
  drafts: Set<AbortController>,
) {
  const { api, connection } = context;
  const mutation = asMutation(
    useMutation({
      mutationFn: ({
        signal,
        ...input
      }: CommitDraftInput & { signal?: AbortSignal }) =>
        api.gitActions.draft({
          ...scope,
          ...connection.request(signal),
          input,
        }),
    }),
  );
  return {
    ...mutation,
    submit: (input: CommitDraftInput) =>
      submitDraft(mutation.submit, drafts, input),
  };
}

async function submitDraft(
  submit: (
    input: CommitDraftInput & { signal?: AbortSignal },
  ) => Promise<CommitDraft>,
  drafts: Set<AbortController>,
  input: CommitDraftInput,
) {
  const controller = new AbortController();
  drafts.add(controller);
  try {
    return await submit({ ...input, signal: controller.signal });
  } finally {
    drafts.delete(controller);
  }
}
