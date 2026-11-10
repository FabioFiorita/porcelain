import { useAtom } from '@effect/atom-react';
import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { archivePullRequest } from '@porcelain/client/projects';
import { ProjectSelectionCommands } from '@porcelain/client/projects';
import type { ArchivePullRequestRequest } from '@porcelain/contracts/projects';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { clientRuntime } from '../../../shared/application/store';
const command = Atom.family(
  (input: {
    connection: RuntimeConnection;
    number: number;
    projectId: string;
    mainWorktreeId: string;
  }) =>
    clientRuntime.fn((payload: ArchivePullRequestRequest, get) =>
      Effect.gen(function* () {
        if (payload.confirmation) {
          const selection = yield* ProjectSelectionCommands;
          yield* selection.execute({
            kind: 'workspace',
            environmentId: input.connection.environmentId,
            projectId: input.projectId,
            worktreeId: input.mainWorktreeId,
          });
        }
        return yield* get.setResult(archivePullRequest(input), payload);
      }),
    ),
);
export function useArchivePullRequest(input: {
  connection: RuntimeConnection;
  number: number;
  projectId: string;
  mainWorktreeId: string;
}) {
  const [result, run] = useAtom(command(input), { mode: 'promise' });
  const submit = async (
    payload: ArchivePullRequestRequest,
    onArchived?: () => void,
  ) => {
    let answer;
    try {
      answer = await run(payload);
    } catch {
      return undefined;
    }
    if (answer.archived && onArchived) onArchived();
    return answer;
  };
  return {
    result,
    submit,
    prepare: (
      options: ArchivePullRequestRequest['options'],
      onStart: () => void,
    ) => {
      onStart();
      void submit({ options });
    },
  };
}
