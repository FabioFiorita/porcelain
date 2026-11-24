import * as Schema from 'effect/Schema';
import { environmentIconSchema } from '@porcelain/contracts/access';
import { projectIdSchema, worktreeIdSchema } from '@porcelain/contracts/shared';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import {
  navigatorEntryMatches,
  navigatorInventoryEntries,
  navigatorProjectVisible,
  navigatorRowTitle,
  type NavigatorEntry,
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
  checkout: Schema.optionalKey(
    Schema.Struct({
      name: label,
      branch: label,
      path: Schema.String.check(Schema.isMaxLength(4096)),
      main: Schema.Boolean,
      detached: Schema.Boolean,
    }),
  ),
});

export const worktreeSnapshotJson = Schema.fromJsonString(
  Schema.Struct({
    version: Schema.Literal(1),
    pairing: Schema.String,
    confirmedAt: Schema.Number,
    computerName: label,
    icon: Schema.optionalKey(environmentIconSchema),
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
  return snapshot.rows
    .filter((row) =>
      navigatorProjectVisible(
        `${environmentId}/${row.projectId}`,
        environmentId,
        filter,
      ),
    )
    .map((row): NavigatorEntry => {
      const checkout = row.checkout;
      return {
        key: `${environmentId}/${row.projectId}/${row.worktreeId}`,
        kind: 'worktree',
        environmentId,
        environmentName: snapshot.computerName,
        projectId: row.projectId,
        projectName: row.projectName,
        worktreeId: row.worktreeId,
        path: checkout?.path,
        name: checkout?.name ?? row.title,
        displayTitle:
          checkout && row.title !== checkout.name ? row.title : undefined,
        branch: checkout?.branch ?? row.title,
        main: checkout?.main ?? false,
        detached: checkout?.detached ?? false,
        available: false,
        pullRequest: { state: 'none' },
        changes: { state: 'loading' },
      };
    })
    .filter((entry) => navigatorEntryMatches(entry, query));
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
      navigatorInventoryEntries(
        project,
        inventory.environmentId,
        inventory.environment.name,
      ).flatMap((entry) =>
        entry.available && entry.worktreeId && entry.path
          ? [
              {
                projectId: project.id,
                projectName: project.name.slice(0, 512),
                worktreeId: entry.worktreeId,
                title: navigatorRowTitle(entry).slice(0, 512),
                checkout: {
                  name: entry.name.slice(0, 512),
                  branch: entry.branch.slice(0, 512),
                  path: entry.path.slice(0, 4096),
                  main: entry.main,
                  detached: entry.detached,
                },
              },
            ]
          : [],
      ),
    );
  return {
    version: 1,
    pairing,
    confirmedAt,
    computerName: inventory.environment.name.slice(0, 512),
    ...(inventory.environment.icon ? { icon: inventory.environment.icon } : {}),
    rows: rows.slice(0, ROW_LIMIT),
  };
}
