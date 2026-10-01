import { useMutation } from '@tanstack/react-query';
import { desktopProjectPicker } from '@/shared/adapters/desktop';
import { useProjectBrowserStore } from '../store';
import { useRegisterProject } from './register-project';
import { type Connection } from '@/shared/workspace/connection';

export function useOpenProject(
  connection: Connection | null,
  close: () => void,
  selectWorktree: (projectId: string, worktreeId: string) => Promise<void>,
) {
  const register = useRegisterProject(connection);
  const picker = desktopProjectPicker(connection?.address);
  const reset = () => {
    register.reset();
    useProjectBrowserStore.getState().reset();
  };
  const submit = async (path: string) => {
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
    if (worktree) await selectWorktree(project.id, worktree.id);
  };
  const selection = useMutation({
    mutationFn: async () => {
      const path = await picker?.();
      if (path == null) {
        close();
        return;
      }
      await submit(path);
    },
  });
  return {
    native: picker !== undefined,
    isPending: register.isPending || selection.isPending,
    error: register.error ?? selection.error,
    onOpenChange: (open: boolean) => {
      if (open && picker !== undefined) selection.mutate();
    },
    onCloseChange: (open: boolean) => {
      if (!open && !register.isPending) {
        reset();
        selection.reset();
      }
    },
    choose: selection.mutate,
    submit,
  };
}
