import { UnsupportedPathEncodingError } from './errors/unsupported-path-encoding-error.ts';
import { executeInspection } from './execute-inspection.ts';

export async function readTreePaths(checkout: string, signal?: AbortSignal) {
  const read = async (args: string[]) => {
    const raw = await executeInspection(
      checkout,
      ['ls-files', '-z', ...args],
      2 * 1024 * 1024,
      signal,
    );
    try {
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
        .decode(raw)
        .split('\0')
        .filter(Boolean);
    } catch (cause) {
      throw new UnsupportedPathEncodingError({ cause });
    }
  };
  const paths = await read(['--cached', '--others', '--exclude-standard']);
  const ignored = await read([
    '--others',
    '--ignored',
    '--exclude-standard',
    '--directory',
  ]);
  return { paths: [...new Set([...paths, ...ignored])].sort(), ignored };
}
