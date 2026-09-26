import type { BigIntStats } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { ReadFailure, WriteFailure } from '@porcelain/files/models';

export type CheckoutPath = { root: string; path: string };

export type InspectedPath = {
  path: string;
  info: BigIntStats;
  evidence: { path: string; info: BigIntStats }[];
};

type Refusal = 'unreadable' | 'changed' | 'trash-unavailable';

const refusals = new WeakMap<Error, Refusal>();

export function pathRefused(refusal: Refusal, options?: ErrorOptions): Error {
  const error = new Error(
    `The path guard refused the path: ${refusal}`,
    options,
  );
  refusals.set(error, refusal);
  return error;
}

function refusalOf(error: unknown): Refusal | undefined {
  return error instanceof Error ? refusals.get(error) : undefined;
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

export function filesystemFailure(error: unknown): WriteFailure | undefined {
  const refusal = refusalOf(error);
  if (refusal !== undefined) return refusal;
  const code = errorCode(error);
  if (code === 'ENOENT') return 'missing';
  if (code === 'EEXIST' || code === 'ENOTEMPTY') return 'exists';
  if (code === 'EXDEV') return 'cross-device';
  if (code !== undefined && unreadableCodes.has(code)) return 'unreadable';
  return undefined;
}

export function readFailure(error: unknown): ReadFailure | undefined {
  const failure = filesystemFailure(error);
  return failure === 'missing' ||
    failure === 'unreadable' ||
    failure === 'changed'
    ? failure
    : undefined;
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

export function fileIdentity(info: BigIntStats): string {
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
    throw pathRefused('unreadable');
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
    if (info.isSymbolicLink()) throw pathRefused('unreadable');
    if (component !== path && !info.isDirectory())
      throw pathRefused('unreadable');
    evidence.push({ path: component, info });
  }
  if ((await realpath(path)) !== path) throw pathRefused('unreadable');
  const info = evidence.at(-1)?.info;
  if (!info) throw pathRefused('unreadable');
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
      refusalOf(error) !== undefined ||
      (code !== undefined && vanishedCodes.has(code))
    )
      throw pathRefused('changed', { cause: error });
    throw error;
  }
  if (!sameEvidence(before, after) || !unchanged(before.info, after.info))
    throw pathRefused('changed');
}
