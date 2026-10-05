import { useMutation } from '@tanstack/react-query';
import { desktopProjectPicker } from '@/shared/adapters/desktop';
import type { WorktreeTarget } from '../rules/worktree-target';
import type { Project } from '@porcelain/client/projects/rules';
import { projectFolder } from '../store';
import { useAtomSet } from '@effect/atom-react';
import { useRegisterProject } from './register-project';
import { type Connection } from '@/shared/workspace/connection';

type Opened = (target: WorktreeTarget) => Promise<void>;

function openedWorktree(remote: string | null, project: Project) {
  const worktree = project.worktrees.find((entry) => entry.available);
  return worktree && { remote, projectId: project.id, worktreeId: worktree.id };
}

export function useOpenProject(
  connection: Connection,
  remote: string | null,
  close: () => void,
  selectWorktree: Opened,
) {
  const register = useRegisterProject(connection);
  const setFolder = useAtomSet(projectFolder);
  const submit = async (path: string) => {
    if (register.isPending) return;
    let project;
    try {
      project = await register.submit(path.trim());
    } catch {
      return;
    }
    const target = openedWorktree(remote, project);
    setFolder(undefined);
    close();
    if (target) await selectWorktree(target);
  };
  return {
    isPending: register.isPending,
    error: register.error,
    submit,
  };
}

export function useResetProjectBrowser() {
  const setFolder = useAtomSet(projectFolder);
  return (open: boolean) => {
    if (!open) setFolder(undefined);
  };
}

export function useNativeProjectPicker(
  connection: Connection,
  selectWorktree: Opened,
  fail: (error: Error) => void,
) {
  const register = useRegisterProject(connection);
  const picker = desktopProjectPicker(connection.address);
  const selection = useMutation({
    mutationFn: async (pick: () => Promise<string | null>) => {
      const path = await pick();
      if (path == null) return;
      const target = openedWorktree(null, await register.submit(path));
      if (target) await selectWorktree(target);
    },
    onError: fail,
  });
  return (
    picker &&
    (() => {
      if (!selection.isPending) selection.mutate(picker);
    })
  );
}
