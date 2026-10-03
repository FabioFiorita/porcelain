import { useMutation } from '@tanstack/react-query';
import { asMutation } from '@/shared/query/mutation';
import type {
  CommitDraft,
  CommitDraftInput,
  GitScope,
} from '../rules/git-action';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { gitActionsApi } from '../api';

export function useCommitDraft(
  scope: GitScope,
  context: ConnectionContext,
  drafts: Set<AbortController>,
) {
  const { connection } = context;
  const mutation = asMutation(
    useMutation({
      mutationFn: ({
        signal,
        ...input
      }: CommitDraftInput & { signal?: AbortSignal }) =>
        gitActionsApi(connection).draft({
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
