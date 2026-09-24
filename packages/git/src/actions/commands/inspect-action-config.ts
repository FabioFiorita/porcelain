import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isMissing } from '../../shared/errors/is-missing.ts';
import {
  filterDrivers,
  parseFilterAttributes,
} from '../../shared/parsers/conversion-filters.ts';
import type { GitActionIntent } from '../dtos/git-action.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { validateActionConfig } from '../parsers/validate-action-config.ts';
import { readActionCommand } from './read-action-command.ts';

export async function inspectActionConfig(
  process: GitProcessRunner,
  signal: AbortSignal,
  action: GitActionIntent['action'],
): Promise<void> {
  const config = await readActionCommand(
    process,
    ['config', '--null', '--list'],
    signal,
  );
  validateActionConfig(config);
  if (action !== 'fetch' && action !== 'push')
    await rejectAssignedFilters(process, config, signal);
  await rejectUncheckableHooks(process, signal);
}

async function rejectUncheckableHooks(
  process: GitProcessRunner,
  signal: AbortSignal,
): Promise<void> {
  const hooks = (
    await readActionCommand(
      process,
      ['rev-parse', '--path-format=absolute', '--git-path', 'hooks'],
      signal,
    )
  ).trimEnd();
  let names: string[];
  try {
    names = await readdir(hooks);
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  for (const name of names.sort()) {
    if (name.endsWith('.sample')) continue;
    const info = await lstat(join(hooks, name));
    if (!info.isFile() || info.size > process.limits.actions.hookBytes)
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
        detail: `The \`${name}\` hook is ${info.isFile() ? `larger than ${process.limits.actions.hookBytes.toLocaleString('en-US')} bytes` : 'not a regular file'}, so Porcelain cannot check it before an action. Replace it with a regular file, or run this action from a terminal.`,
      });
  }
}

async function rejectAssignedFilters(
  process: GitProcessRunner,
  config: string,
  signal: AbortSignal,
): Promise<void> {
  const drivers = filterDrivers(config);
  if (!drivers.size) return;
  for (const [driver, key] of drivers)
    if (!/^[\w-]+$/u.test(driver))
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
    driver = (await filterAttributes(process, `${path}\0`, signal))[0]?.filter;
  else {
    const added = await process.execute(
      ['ls-files', '-z', '--others', '--exclude-standard'],
      signal,
    );
    const names = added.stdout.toString('utf8');
    const count = names.split('\0').length - 1;
    if (processFailure(added) || count > process.limits.actions.maxNewFiles)
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
        detail: `This checkout has more new files than Porcelain can check for the filters in \`${[...drivers.values()].join('`, `')}\` (at most ${process.limits.actions.maxNewFiles.toLocaleString('en-US')}). Ignore generated folders in \`.gitignore\`, or run this action from a terminal.`,
      });
    if (!count) return;
    const filtered = (await filterAttributes(process, names, signal)).find(
      (record) => drivers.has(record.filter),
    );
    if (!filtered) return;
    path = filtered.path;
    driver = filtered.filter;
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
): Promise<{ path: string; filter: string }[]> {
  return parseFilterAttributes(
    await readActionCommand(
      process,
      ['check-attr', '-z', '--stdin', 'filter'],
      signal,
      paths,
    ),
  );
}
