import { execFileSync } from 'node:child_process';

const specPath = /^apps\/web\/spec\/e2e\/[a-z0-9-]+(?:\.desktop)?\.e2e\.ts$/;

export function routineWebSpec(
  files: readonly { filename: string; status: string }[],
): string | undefined {
  const [file] = files;
  if (
    files.length !== 1 ||
    file?.status !== 'modified' ||
    specPath.exec(file.filename)?.[0] !== file.filename
  )
    return undefined;
  return file.filename.slice('apps/web/'.length);
}

if (import.meta.main) {
  const diff = execFileSync(
    'git',
    ['diff', '--no-renames', '--name-status', '-z', 'HEAD^1...HEAD^2', '--'],
    { encoding: 'utf8' },
  );
  const entries = diff.split('\0');
  const [status, filename] = entries;
  if (entries.length === 3 && status === 'M' && filename !== undefined)
    process.stdout.write(
      routineWebSpec([{ filename, status: 'modified' }]) ?? '',
    );
}
