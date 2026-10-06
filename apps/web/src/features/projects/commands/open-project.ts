import { Cause, Effect, Exit, Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import { DesktopHost } from '@/shared/adapters/desktop';
import type { WorktreeTarget } from '../rules/worktree-target';
import type { Project } from '@porcelain/client/projects/rules';
import { projectFolder } from '../store';
import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react';
import { useRegisterProject } from './register-project';
import { registerProject } from '@porcelain/client/projects';
import { ConnectionError } from '@porcelain/client/transport';
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
  const [registration, register] = useRegisterProject(connection);
  const setFolder = useAtomSet(projectFolder);
  const submit = async (path: string) => {
    if (registration.waiting) return;
    let project;
    try {
      project = await register(path.trim());
    } catch {
      return;
    }
    const target = openedWorktree(remote, project);
    setFolder(undefined);
    close();
    if (target) await selectWorktree(target);
  };
  return {
    result: registration,
    submit,
  };
}

export function useResetProjectBrowser() {
  const setFolder = useAtomSet(projectFolder);
  return (open: boolean) => {
    if (!open) setFolder(undefined);
  };
}

const desktopHost = Atom.runtime(DesktopHost.layer).atom(DesktopHost);
const pickProject = Atom.family((connection: Connection) =>
  connection.atoms(DesktopHost.layer).fn((selectWorktree: Opened, get) =>
    Effect.gen(function* () {
      const desktop = yield* DesktopHost;
      const path = yield* desktop.pickProject(connection.address);
      if (path === null) return;
      const project = yield* get.setResult(registerProject(connection), path);
      const target = openedWorktree(null, project);
      if (target)
        yield* Effect.tryPromise({
          try: () => selectWorktree(target),
          catch: (cause) =>
            new ConnectionError({
              message: 'Could not open the selected worktree.',
              cause,
            }),
        });
    }),
  ),
);

export function useNativeProjectPicker(
  connection: Connection,
  selectWorktree: Opened,
  fail: (error: Error) => void,
) {
  const desktop = Option.getOrUndefined(
    AsyncResult.value(useAtomValue(desktopHost)),
  );
  const [selection, run] = useAtom(pickProject(connection), {
    mode: 'promiseExit',
  });
  return (
    desktop?.canPickProject(connection.address) &&
    (() => {
      if (selection.waiting) return;
      void run(selectWorktree).then((exit) => {
        if (Exit.isFailure(exit)) {
          const error = Cause.squash(exit.cause);
          fail(
            error instanceof Error
              ? error
              : new ConnectionError({
                  message: 'Could not open the selected worktree.',
                  cause: error,
                }),
          );
        }
      });
    })
  );
}
