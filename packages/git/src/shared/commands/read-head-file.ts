import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type HeadState, parseHeadFile } from '../parsers/refs.ts';

export async function readHeadFile(
  gitDirectory: string,
): Promise<HeadState | undefined> {
  return parseHeadFile(await readFile(join(gitDirectory, 'HEAD'), 'utf8'));
}
