import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isOid } from './oid.ts';

export const HEAD_BRANCH_ARGS: readonly string[] = [
  'symbolic-ref',
  '--quiet',
  'HEAD',
];

export const STASH_LIST_ARGS: readonly string[] = [
  'stash',
  'list',
  '--format=%H%x00%gd%x00%gs',
];

export type HeadState =
  | { kind: 'attached'; ref: string }
  | { kind: 'detached' };

export type StashEntry = { oid: string; selector: string; message: string };

export function parseSymbolicRef(result: {
  exitCode: number | null;
  stdout: Buffer;
}): string | null {
  if (result.exitCode !== 0) return null;
  const ref = result.stdout.toString('utf8').trimEnd();
  return ref === '' ? null : ref;
}

export function shortBranchName(ref: string): string {
  return ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
}

export function parseHeadFile(text: string): HeadState | undefined {
  const head = text.trim();
  const ref = /^ref: (refs\/\S+)$/u.exec(head)?.[1];
  if (ref !== undefined) return { kind: 'attached', ref };
  return isOid(head) ? { kind: 'detached' } : undefined;
}

export async function readHeadFile(
  gitDirectory: string,
): Promise<HeadState | undefined> {
  return parseHeadFile(await readFile(join(gitDirectory, 'HEAD'), 'utf8'));
}

export function parseStashList(output: string): StashEntry[] {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [oid = '', selector = '', message = ''] = line.split('\0');
      return { oid, selector, message };
    });
}
