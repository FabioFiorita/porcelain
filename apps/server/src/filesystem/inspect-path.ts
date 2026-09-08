import type { BigIntStats } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { FileTarget } from '../models/file-content.ts';
import { FileInspectionError } from './errors/file-inspection-error.ts';

export function sameFile(left: BigIntStats, right: BigIntStats) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.mode === right.mode
  );
}
export function unchanged(left: BigIntStats, right: BigIntStats) {
  return (
    sameFile(left, right) &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}
export async function inspectPath(target: FileTarget, signal?: AbortSignal) {
  const root = resolve(target.root);
  const path = resolve(root, target.path);
  const local = relative(root, path);
  if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`))
    throw new FileInspectionError('PATH_NOT_READABLE');
  const components = local === '' ? [] : local.split(sep);
  const paths = [
    root,
    ...components.map((_, index) =>
      resolve(root, ...components.slice(0, index + 1)),
    ),
  ];
  const evidence: { path: string; info: BigIntStats }[] = [];
  for (const component of paths) {
    signal?.throwIfAborted();
    const info = await lstat(component, { bigint: true });
    if (info.isSymbolicLink())
      throw new FileInspectionError('PATH_NOT_READABLE');
    if (component !== path && !info.isDirectory())
      throw new FileInspectionError('PATH_NOT_READABLE');
    evidence.push({ path: component, info });
  }
  if ((await realpath(path)) !== path)
    throw new FileInspectionError('PATH_NOT_READABLE');
  const info = evidence.at(-1)?.info;
  if (!info) throw new FileInspectionError('PATH_NOT_READABLE');
  return { path, info, evidence };
}
export async function verifyPath(
  before: Awaited<ReturnType<typeof inspectPath>>,
  target: FileTarget,
  signal?: AbortSignal,
) {
  try {
    const after = await inspectPath(target, signal);
    if (
      before.evidence.some((entry, index) => {
        const current = after.evidence[index];
        return !current || !sameFile(entry.info, current.info);
      }) ||
      !unchanged(before.info, after.info)
    )
      throw new FileInspectionError('CONTENT_CHANGED');
  } catch (error) {
    signal?.throwIfAborted();
    if (
      error instanceof FileInspectionError ||
      (error instanceof Error &&
        'code' in error &&
        ['ENOENT', 'EACCES', 'EPERM', 'ELOOP', 'ENOTDIR'].includes(
          String(error.code),
        ))
    )
      throw new FileInspectionError('CONTENT_CHANGED', { cause: error });
    throw error;
  }
}
