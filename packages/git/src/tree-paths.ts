import { UnsupportedPathEncodingError } from './errors/unsupported-path-encoding-error.ts';
import { runInspection } from './read-inspection.ts';

export async function readTreePaths(checkout: string, signal?: AbortSignal) {
  const read = async (args: string[]) => {
    const raw = await runInspection(
      checkout,
      ['ls-files', '-z', ...args],
      signal,
      { maxBytes: 8 * 1024 * 1024 },
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
