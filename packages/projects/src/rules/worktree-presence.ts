import type { WorktreePresence } from '../models/worktree-presence.ts';

export function sighted(
  rows: readonly WorktreePresence[],
  projectId: string,
  presentIds: readonly string[],
): WorktreePresence[] {
  const present = new Set(presentIds);
  return [
    ...presentIds.map((worktreeId) => ({
      worktreeId,
      projectId,
      missingSince: undefined,
    })),
    ...rows.filter((row) => !present.has(row.worktreeId)),
  ];
}

export function observed(
  rows: readonly WorktreePresence[],
  projectId: string,
  presentIds: readonly string[],
  at: string,
): WorktreePresence[] {
  const present = new Set(presentIds);
  return sighted(rows, projectId, presentIds).map((row) =>
    present.has(row.worktreeId)
      ? row
      : { ...row, missingSince: row.missingSince ?? at },
  );
}

export function expired(
  rows: readonly WorktreePresence[],
  now: string,
  graceMs: number,
): string[] {
  return rows
    .filter(
      (row) =>
        row.missingSince !== undefined &&
        Date.parse(now) - Date.parse(row.missingSince) > graceMs,
    )
    .map((row) => row.worktreeId);
}
