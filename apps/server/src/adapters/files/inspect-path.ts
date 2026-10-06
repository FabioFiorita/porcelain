import { Effect } from 'effect';
import { syscall } from './guarded-filesystem-syscalls.ts';
import { GuardedFilesystemError } from '../../runtime/errors/guarded-filesystem-error.ts';
import { PathRefusedError } from '../../runtime/errors/path-refused-error.ts';
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

export type GuardedPathFailure = GuardedFilesystemError | PathRefusedError;

export function pathRefused(
  refusal: PathRefusedError['refusal'],
  options?: ErrorOptions,
): PathRefusedError {
  return new PathRefusedError({
    refusal,
    ...(options?.cause === undefined ? {} : { cause: options.cause }),
  });
}

function refusalOf(error: unknown): PathRefusedError['refusal'] | undefined {
  return error instanceof PathRefusedError ? error.refusal : undefined;
}

const unreadableCodes = new Set([
  'EACCES',
  'EPERM',
  'ELOOP',
  'ENOTDIR',
  'EISDIR',
  'ENXIO',
  'ENAMETOOLONG',
]);
const vanishedCodes = new Set([
  'ENOENT',
  'EACCES',
  'EPERM',
  'ELOOP',
  'ENOTDIR',
]);

function errorCode(error: unknown): string | undefined {
  if (error instanceof GuardedFilesystemError) return errorCode(error.cause);
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
  if (code === 'ENOSPC' || code === 'EDQUOT') return 'no-space';
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

export const inspectPath = Effect.fn('inspectPath')(function* (
  target: CheckoutPath,
): Effect.fn.Return<InspectedPath, GuardedPathFailure> {
  const root = resolve(target.root);
  const path = resolve(root, target.path);
  const local = relative(root, path);
  if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`))
    return yield* Effect.fail(pathRefused('unreadable'));
  const components = local === '' ? [] : local.split(sep);
  const paths = [
    root,
    ...components.map((_, index) =>
      resolve(root, ...components.slice(0, index + 1)),
    ),
  ];
  const evidence: InspectedPath['evidence'] = [];
  for (const component of paths) {
    const info = yield* syscall(() => lstat(component, { bigint: true }));
    if (info.isSymbolicLink())
      return yield* Effect.fail(pathRefused('unreadable'));
    if (component !== path && !info.isDirectory())
      return yield* Effect.fail(pathRefused('unreadable'));
    evidence.push({ path: component, info });
  }
  if ((yield* syscall(() => realpath(path))) !== path)
    return yield* Effect.fail(pathRefused('unreadable'));
  const info = evidence.at(-1)?.info;
  if (!info) return yield* Effect.fail(pathRefused('unreadable'));
  return { path, info, evidence };
});

export function sameEvidence(before: InspectedPath, after: InspectedPath) {
  return before.evidence.every((entry, index) => {
    const current = after.evidence[index];
    return current !== undefined && sameFile(entry.info, current.info);
  });
}

export const verifyPath = Effect.fn('verifyPath')(function* (
  before: InspectedPath,
  target: CheckoutPath,
) {
  const after = yield* inspectPath(target).pipe(
    Effect.catch((error) => {
      const code = errorCode(error);
      return refusalOf(error) !== undefined ||
        (code !== undefined && vanishedCodes.has(code))
        ? Effect.fail(pathRefused('changed', { cause: error }))
        : Effect.fail(error);
    }),
  );
  if (!sameEvidence(before, after) || !unchanged(before.info, after.info))
    return yield* Effect.fail(pathRefused('changed'));
});
