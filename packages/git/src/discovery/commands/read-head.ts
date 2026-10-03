import { readHeadFile } from '../../shared/commands/read-head-file.ts';

export async function readHead(
  administrativeDirectory: string,
): Promise<string | null> {
  try {
    const head = await readHeadFile(administrativeDirectory);
    return head?.kind === 'attached' ? head.ref : null;
  } catch {
    return null;
  }
}
