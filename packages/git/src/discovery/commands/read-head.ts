import { readHeadFile } from '../../shared/refs.ts';

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
