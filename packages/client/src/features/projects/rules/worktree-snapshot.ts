import * as Schema from 'effect/Schema';
import { projectIdSchema, worktreeIdSchema } from '@porcelain/contracts/shared';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import {
  navigatorDisplayTitle,
  navigatorProjectVisible,
  navigatorWorktreeOrder,
  type NavigatorFilter,
} from './worktree-navigator.ts';

const ROW_LIMIT = 256;
const label = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(512),
);
const row = Schema.Struct({
  projectId: projectIdSchema,
  projectName: label,
  worktreeId: worktreeIdSchema,
  title: label,
});

export const worktreeSnapshotJson = Schema.fromJsonString(
  Schema.Struct({
    version: Schema.Literal(1),
    pairing: Schema.String,
    confirmedAt: Schema.Number,
    computerName: label,
    rows: Schema.Array(row).check(Schema.isMaxLength(ROW_LIMIT)),
  }),
);

export type WorktreeSnapshot = typeof worktreeSnapshotJson.Type;

export function savedWorktreeRows(
  snapshot: WorktreeSnapshot,
  environmentId: string,
  query: string,
  filter: NavigatorFilter,
) {
  const text = query.trim().toLowerCase();
  return snapshot.rows.filter(
    (row) =>
      navigatorProjectVisible(
        `${environmentId}/${row.projectId}`,
        environmentId,
        filter,
      ) &&
      [row.title, row.projectName, snapshot.computerName].some((label) =>
        label.toLowerCase().includes(text),
      ),
  );
}

export function projectWorktreeSnapshot(
  inventory: ReadInventoryResponse,
  pairing: string,
  confirmedAt: number,
): WorktreeSnapshot {
  const rows = inventory.projects
    .filter((project) => project.available)
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((project) =>
      project.worktrees
        .filter((worktree) => worktree.available)
        .map((worktree) => ({
          ...worktree,
          key: worktree.id,
          name: worktree.branch ?? 'Detached HEAD',
        }))
        .sort(navigatorWorktreeOrder)
        .map((worktree) => ({
          projectId: project.id,
          projectName: project.name.slice(0, 512),
          worktreeId: worktree.id,
          title: (navigatorDisplayTitle(worktree) ?? worktree.name).slice(
            0,
            512,
          ),
        })),
    );
  return {
    version: 1,
    pairing,
    confirmedAt,
    computerName: inventory.environment.name.slice(0, 512),
    rows: rows.slice(0, ROW_LIMIT),
  };
}
