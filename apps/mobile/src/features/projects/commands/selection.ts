import { useIsMutating, useMutation } from '@tanstack/react-query';
import { projectSelectionStore } from '../store';

type SelectionCommand =
  | { kind: 'read' }
  | { kind: 'environment'; environmentId: string }
  | {
      kind: 'worktree';
      environmentId: string;
      projectId: string;
      worktreeId: string;
    };

export function useProjectSelectionCommands(access: {
  hasEnvironment: (environmentId: string) => boolean;
  readEnvironmentIds: () => string[] | undefined;
}) {
  const pending = useIsMutating({ mutationKey: ['projects', 'selection'] });
  const mutation = useMutation({
    mutationKey: ['projects', 'selection'],
    scope: { id: 'access.environments' },
    mutationFn: async (command: SelectionCommand) => {
      const state = projectSelectionStore.getState();
      if (command.kind === 'read') {
        await state.load();
        const paired = access.readEnvironmentIds();
        const saved = projectSelectionStore.getState();
        if (!paired || saved.status !== 'ready') return;
        const remembered = new Set(Object.keys(saved.selections));
        if (saved.currentEnvironmentId)
          remembered.add(saved.currentEnvironmentId);
        for (const environmentId of remembered) {
          if (!paired.includes(environmentId))
            await saved.forgetEnvironment(environmentId);
        }
        return;
      }
      if (!access.hasEnvironment(command.environmentId))
        throw new Error(
          'That environment is no longer paired. Open the environment picker again.',
        );
      if (command.kind === 'environment')
        return state.selectEnvironment(command.environmentId);
      return state.selectWorktree(
        command.environmentId,
        command.projectId,
        command.worktreeId,
      );
    },
  });
  return {
    submit: mutation.mutate,
    isPending: pending > 0,
    error: mutation.error,
  };
}
