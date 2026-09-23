import type { BigIntStats } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { FileFailure } from '@porcelain/files/models';

export type CheckoutPath = { root: string; path: string };

export type InspectedPath = {
  path: string;
  info: BigIntStats;
  evidence: { path: string; info: BigIntStats }[];
};

export class PathGuardError extends Error {
  override readonly name = 'PathGuardError';
  readonly failure: FileFailure;

  constructor(failure: FileFailure, options?: ErrorOptions) {
    super(`The path guard refused the path: ${failure}`, options);
    this.failure = failure;
  }
}

const unreadableCodes = new Set([
  'EACCES',
  'EPERM',
  'ELOOP',
  'ENOTDIR',
  'EISDIR',
  'ENXIO',
]);
const vanishedCodes = new Set([
  'ENOENT',
  'EACCES',
  'EPERM',
  'ELOOP',
  'ENOTDIR',
]);

function errorCode(error: unknown) {
  return error instanceof Error && 'code' in error
    ? String(error.code)
    : undefined;
}

export function filesystemFailure(error: unknown): FileFailure | undefined {
  if (error instanceof PathGuardError) return error.failure;
  const code = errorCode(error);
  if (code === 'ENOENT') return 'missing';
  if (code === 'EEXIST' || code === 'ENOTEMPTY') return 'exists';
  if (code === 'EXDEV') return 'cross-device';
  if (code !== undefined && unreadableCodes.has(code)) return 'unreadable';
  return undefined;
}

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

export function revisionOf(info: BigIntStats) {
  return [
    info.dev,
    info.ino,
    info.birthtimeNs,
    info.mode,
    info.size,
    info.mtimeNs,
    info.ctimeNs,
  ].join(':');
}

export async function inspectPath(
  target: CheckoutPath,
  signal?: AbortSignal,
): Promise<InspectedPath> {
  const root = resolve(target.root);
  const path = resolve(root, target.path);
  const local = relative(root, path);
  if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`))
    throw new PathGuardError('unreadable');
  const components = local === '' ? [] : local.split(sep);
  const paths = [
    root,
    ...components.map((_, index) =>
      resolve(root, ...components.slice(0, index + 1)),
    ),
  ];
  const evidence: InspectedPath['evidence'] = [];
  for (const component of paths) {
    signal?.throwIfAborted();
    const info = await lstat(component, { bigint: true });
    if (info.isSymbolicLink()) throw new PathGuardError('unreadable');
    if (component !== path && !info.isDirectory())
      throw new PathGuardError('unreadable');
    evidence.push({ path: component, info });
  }
  if ((await realpath(path)) !== path) throw new PathGuardError('unreadable');
  const info = evidence.at(-1)?.info;
  if (!info) throw new PathGuardError('unreadable');
  return { path, info, evidence };
}

export function sameEvidence(before: InspectedPath, after: InspectedPath) {
  return before.evidence.every((entry, index) => {
    const current = after.evidence[index];
    return current !== undefined && sameFile(entry.info, current.info);
  });
}

export async function verifyPath(
  before: InspectedPath,
  target: CheckoutPath,
  signal?: AbortSignal,
) {
  let after: InspectedPath;
  try {
    after = await inspectPath(target, signal);
  } catch (error) {
    signal?.throwIfAborted();
    const code = errorCode(error);
    if (
      error instanceof PathGuardError ||
      (code !== undefined && vanishedCodes.has(code))
    )
      throw new PathGuardError('changed', { cause: error });
    throw error;
  }
  if (!sameEvidence(before, after) || !unchanged(before.info, after.info))
    throw new PathGuardError('changed');
}
