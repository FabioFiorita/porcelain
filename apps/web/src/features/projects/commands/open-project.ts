import type { ProjectConnection } from '../rules/connection';
import { useProjectBrowserStore } from '../store';
import { useRegisterProject } from './register-project';

export function useOpenProject(
  connection: ProjectConnection | null,
  close: () => void,
  selectWorktree: (id: string) => Promise<void>,
) {
  const register = useRegisterProject(connection);
  const reset = () => {
    register.reset();
    useProjectBrowserStore.getState().reset();
  };
  return {
    isPending: register.isPending,
    error: register.error,
    onCloseChange: (open: boolean) => {
      if (!open && !register.isPending) reset();
    },
    submit: async (path: string) => {
      if (register.isPending) return;
      let project;
      try {
        project = await register.submit(path.trim());
      } catch {
        return;
      }
      const worktree = project.worktrees.find((entry) => entry.available);
      reset();
      close();
      if (worktree) await selectWorktree(worktree.id);
    },
  };
}
