import type { ChangeComparison } from '@porcelain/kernel/models';
import { createHash } from 'node:crypto';
import type { WorktreeSide } from '../models/worktree-side.ts';

type Encodable =
  | string
  | boolean
  | undefined
  | readonly Encodable[]
  | { readonly [key: string]: Encodable };

export function fingerprintChange(
  path: string,
  comparisons: readonly ChangeComparison[],
  sides: ReadonlyMap<string, WorktreeSide>,
): string | undefined {
  const encoded: Encodable[] = [];
  for (const comparison of comparisons) {
    const side = sideOf(comparison, sides);
    if (side === undefined) return undefined;
    encoded.push(side);
  }
  return createHash('sha256')
    .update(canonical({ path, sides: encoded }))
    .digest('hex');
}

function canonical(value: Encodable): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object')
    return `{${Object.entries(value)
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function sideOf(
  comparison: ChangeComparison,
  sides: ReadonlyMap<string, WorktreeSide>,
): Encodable {
  if (comparison.scope === 'unmerged')
    return {
      scope: 'unmerged',
      path: comparison.path,
      conflict: comparison.conflict,
      modes: comparison.modes,
      oids: comparison.oids,
      worktree: workingSide(sides.get(comparison.path)) ?? { missing: true },
    };
  if (comparison.scope === 'untracked') {
    const working = workingSide(sides.get(comparison.path));
    if (working === undefined) return undefined;
    return { scope: 'untracked', path: comparison.path, ...working };
  }
  const base = {
    scope: comparison.scope,
    kind: comparison.kind,
    oldPath: comparison.oldPath,
    newPath: comparison.newPath,
    oldMode: comparison.oldMode,
    newMode: comparison.newMode,
    oldOid: comparison.oldOid,
  };
  if (comparison.scope === 'staged')
    return comparison.newOid === undefined && comparison.kind !== 'deleted'
      ? undefined
      : { ...base, newOid: comparison.newOid };
  if (comparison.kind === 'deleted')
    return { ...base, newOid: comparison.newOid };
  const working = workingSide(
    comparison.newPath === undefined
      ? undefined
      : sides.get(comparison.newPath),
  );
  if (working === undefined) return undefined;
  return { ...base, ...working };
}

function workingSide(
  observed: WorktreeSide | undefined,
): { readonly [key: string]: string } | undefined {
  if (observed?.symlink !== undefined) return { symlink: observed.symlink };
  if (observed?.submodule !== undefined)
    return { submodule: observed.submodule };
  if (observed?.digest !== undefined) return { digest: observed.digest };
  return undefined;
}
