import type { ReactNode } from 'react';
import { Atom } from 'effect/reactivity';
import { createToastManager } from '@/components/ui/toast';
import {
  worktreeStatusNotices as statusNotices,
  refreshWorktreeNavigator,
} from '@porcelain/client/projects';
import type { NavigatorStatusNotice } from '@porcelain/client/projects/rules';
import type { Connection } from '@/shared/workspace/connection';

export const worktreeStatusToast = createToastManager();
export type WorktreeStatusIssue = NavigatorStatusNotice;

export const worktreeStatusNotices = Atom.family(
  (input: {
    connections: readonly Connection[];
    description: (issue: WorktreeStatusIssue) => ReactNode;
  }) =>
    Atom.make((get) => {
      const notices = new Map<string, { id: string; signature: string }>();
      const registry = get.registry;
      const refresh = refreshWorktreeNavigator(input.connections);
      const actionProps = (environmentId: string) => ({
        children: registry.get(refresh).waiting ? 'Retrying…' : 'Retry',
        disabled: registry.get(refresh).waiting,
        onClick: () => registry.set(refresh, { environmentId }),
      });
      get.subscribe(
        statusNotices,
        (state) => {
          const active = state.filter(
            (issue) =>
              !issue.dismissed &&
              input.connections.some(
                (connection) =>
                  connection.environmentId === issue.environmentId,
              ),
          );
          for (const [environmentId, notice] of notices)
            if (
              !active.some((issue) => issue.environmentId === environmentId)
            ) {
              notices.delete(environmentId);
              worktreeStatusToast.close(notice.id);
            }
          for (const issue of active) {
            const environmentId = issue.environmentId;
            const signature = JSON.stringify([
              issue.environmentName,
              issue.failures.map(({ entry, detail }) => [
                entry.key,
                entry.name,
                detail,
              ]),
            ]);
            const notice = notices.get(environmentId);
            const content = {
              title: `Couldn’t check changes on ${issue.environmentName}`,
              description: input.description(issue),
            };
            if (notice) {
              if (notice.signature !== signature) {
                worktreeStatusToast.update(notice.id, content);
                notice.signature = signature;
              }
              continue;
            }
            const id = worktreeStatusToast.add({
              ...content,
              priority: 'low',
              actionProps: actionProps(environmentId),
              onClose: () =>
                registry.update(statusNotices, (current) =>
                  current.some(
                    (notice) =>
                      notice.environmentId === environmentId &&
                      !notice.dismissed,
                  )
                    ? current.map((notice) =>
                        notice.environmentId === environmentId
                          ? { ...notice, dismissed: true }
                          : notice,
                      )
                    : current,
                ),
            });
            notices.set(environmentId, { id, signature });
          }
        },
        { immediate: true },
      );
      get.subscribe(refresh, () => {
        for (const [environmentId, notice] of notices)
          worktreeStatusToast.update(notice.id, {
            actionProps: actionProps(environmentId),
          });
      });
      get.addFinalizer(() => {
        for (const notice of notices.values())
          worktreeStatusToast.close(notice.id);
      });
    }),
);
