import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GitActionIntent } from '../dtos/git-action.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import { validateActionConfig } from '../helpers/validate-action-config.ts';
import type { GitProcessRunner } from '../../shared/interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';
import { readActionCommand } from './read-action-command.ts';

export async function inspectActionConfig(
  process: GitProcessRunner,
  signal: AbortSignal,
  action?: GitActionIntent['action'],
): Promise<string> {
  const config = await readActionCommand(
    process,
    ['config', '--null', '--list'],
    signal,
  );
  validateActionConfig(config);
  if (action !== 'fetch' && action !== 'push')
    await rejectAssignedFilters(process, config, signal);
  const hash = createHash('sha256').update(config);
  const hooks = (
    await readActionCommand(
      process,
      ['rev-parse', '--path-format=absolute', '--git-path', 'hooks'],
      signal,
    )
  ).trimEnd();
  try {
    for (const name of (await readdir(hooks)).sort()) {
      if (name.endsWith('.sample')) continue;
      const path = join(hooks, name);
      const info = await lstat(path);
      if (!info.isFile() || info.size > 1024 * 1024)
        throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
          detail: `The \`${name}\` hook is ${info.isFile() ? 'larger than 1 MB' : 'not a regular file'}, so Porcelain cannot check it before an action. Replace it with a regular file, or run this action from a terminal.`,
        });
      hash
        .update(name)
        .update(String(info.mode))
        .update(await readFile(path));
    }
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
      throw error;
  }
  return hash.digest('hex');
}

async function rejectAssignedFilters(
  process: GitProcessRunner,
  config: string,
  signal: AbortSignal,
): Promise<void> {
  const commands = new Map<string, string>();
  for (const record of config.split('\0')) {
    const separator = record.indexOf('\n');
    const key = record.slice(0, separator);
    if (/^filter\..+\.(?:clean|smudge|process)$/i.test(key))
      commands.set(key, record.slice(separator + 1));
  }
  const drivers = new Map<string, string>();
  for (const [key, command] of commands) {
    const driver = key.slice('filter.'.length, key.lastIndexOf('.'));
    if (command && !drivers.has(driver)) drivers.set(driver, key);
  }
  if (!drivers.size) return;
  for (const [driver, key] of drivers)
    if (!/^[\w-]+$/.test(driver))
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
        detail: `Git config sets \`${key}\`, a filter Porcelain cannot look up by name. Run this action from a terminal instead.`,
      });
  const tracked = await process.execute(
    [
      'ls-files',
      '-z',
      '--cached',
      '--',
      ...[...drivers.keys()].map((driver) => `:(attr:filter=${driver})`),
    ],
    signal,
  );
  const failure = processFailure(tracked);
  if (failure && tracked.failure !== 'output-limit')
    throw new GitActionRejectedError(failure.reason ?? 'GIT_REJECTED');
  let path = tracked.stdout.toString('utf8').split('\0')[0];
  let driver: string | undefined;
  if (path)
    driver = (await filterAttributes(process, `${path}\0`, signal))[0]?.[1];
  else {
    const added = await process.execute(
      ['ls-files', '-z', '--others', '--exclude-standard'],
      signal,
    );
    const names = added.stdout.toString('utf8');
    const count = names.split('\0').length - 1;
    if (processFailure(added) || count > 10_000)
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
        detail: `This checkout has more new files than Porcelain can check for the filters in \`${[...drivers.values()].join('`, `')}\` (at most 10,000). Ignore generated folders in \`.gitignore\`, or run this action from a terminal.`,
      });
    if (!count) return;
    [path, driver] =
      (await filterAttributes(process, names, signal)).find(([, value]) =>
        drivers.has(value),
      ) ?? [];
    if (!path) return;
  }
  const key = drivers.get(driver ?? '') ?? [...drivers.values()].join('`, `');
  throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
    detail: `\`${path}\` goes through the filter that \`${key}\` runs. Porcelain does not run conversion filters, so it cannot check the content it would commit or stash. Run this action from a terminal instead.`,
  });
}

async function filterAttributes(
  process: GitProcessRunner,
  paths: string,
  signal: AbortSignal,
): Promise<[string, string][]> {
  const fields = (
    await readActionCommand(
      process,
      ['check-attr', '-z', '--stdin', 'filter'],
      signal,
      paths,
    )
  ).split('\0');
  const records: [string, string][] = [];
  for (let index = 0; index + 2 < fields.length; index += 3)
    records.push([fields[index] ?? '', fields[index + 2] ?? '']);
  return records;
}
