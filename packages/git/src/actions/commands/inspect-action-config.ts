import { readActionFile } from './read-action-file.ts';
import { Effect, FileSystem } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import { join } from 'node:path';
import {
  filterDrivers,
  parseFilterAttributes,
} from '../../shared/parsers/conversion-filters.ts';
import type { GitActionIntent } from '../dtos/git-action.ts';
import { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { validateActionConfig } from '../parsers/validate-action-config.ts';
import { readActionCommand } from './read-action-command.ts';

export const inspectActionConfig = Effect.fn('Git.inspectActionConfig')(
  function* (
    process: GitProcessRunner,
    action: GitActionIntent['action'],
  ): Effect.fn.Return<void, ActionFailure, ActionPlatform> {
    const config = yield* readActionCommand(process, [
      'config',
      '--null',
      '--list',
    ]);
    yield* validateActionConfig(config);
    if (action !== 'fetch' && action !== 'push')
      yield* rejectAssignedFilters(process, config);
    yield* rejectUncheckableHooks(process);
  },
);

const rejectUncheckableHooks = Effect.fn('Git.rejectUncheckableHooks')(
  function* (
    process: GitProcessRunner,
  ): Effect.fn.Return<void, ActionFailure, ActionPlatform> {
    const hooks = (yield* readActionCommand(process, [
      'rev-parse',
      '--path-format=absolute',
      '--git-path',
      'hooks',
    ])).trimEnd();
    const fs = yield* FileSystem.FileSystem;
    const names = yield* fs
      .readDirectory(hooks)
      .pipe(
        Effect.catchReason('PlatformError', 'NotFound', () =>
          Effect.succeed([]),
        ),
      );
    for (const name of names.sort((a, b) => a.localeCompare(b))) {
      if (name.endsWith('.sample')) continue;
      const info = yield* readActionFile(join(hooks, name));
      if (!info?.isFile() || info.size > process.limits.actions.hookBytes)
        return yield* new GitActionRejectedError({
          reason: 'UNSUPPORTED_CONFIGURATION',
          detail: `The \`${name}\` hook is ${info?.isFile() ? `larger than ${process.limits.actions.hookBytes.toLocaleString('en-US')} bytes` : 'not a regular file'}, so Porcelain cannot check it before an action. Replace it with a regular file, or run this action from a terminal.`,
        });
    }
  },
);

const rejectAssignedFilters = Effect.fn('Git.rejectAssignedFilters')(function* (
  process: GitProcessRunner,
  config: string,
): Effect.fn.Return<void, ActionFailure, ActionPlatform> {
  const drivers = filterDrivers(config);
  if (!drivers.size) return;
  for (const [driver, key] of drivers)
    if (!/^[\w-]+$/u.test(driver))
      return yield* new GitActionRejectedError({
        reason: 'UNSUPPORTED_CONFIGURATION',
        detail: `Git config sets \`${key}\`, a filter Porcelain cannot look up by name. Run this action from a terminal instead.`,
      });
  const tracked = yield* process.execute([
    'ls-files',
    '-z',
    '--cached',
    '--',
    ...[...drivers.keys()].map((driver) => `:(attr:filter=${driver})`),
  ]);
  const failure = processFailure(tracked);
  if (failure && tracked.failure !== 'output-limit')
    return yield* new GitActionRejectedError({
      reason: failure.reason ?? 'GIT_REJECTED',
    });
  let path = tracked.stdout.toString('utf8').split('\0')[0];
  let driver: string | undefined;
  if (path) driver = (yield* filterAttributes(process, `${path}\0`))[0]?.filter;
  else {
    const added = yield* process.execute([
      'ls-files',
      '-z',
      '--others',
      '--exclude-standard',
    ]);
    const names = added.stdout.toString('utf8');
    const count = names.split('\0').length - 1;
    if (processFailure(added) || count > process.limits.actions.maxNewFiles)
      return yield* new GitActionRejectedError({
        reason: 'UNSUPPORTED_CONFIGURATION',
        detail: `This checkout has more new files than Porcelain can check for the filters in \`${[...drivers.values()].join('`, `')}\` (at most ${process.limits.actions.maxNewFiles.toLocaleString('en-US')}). Ignore generated folders in \`.gitignore\`, or run this action from a terminal.`,
      });
    if (!count) return;
    const filtered = (yield* filterAttributes(process, names)).find((record) =>
      drivers.has(record.filter),
    );
    if (!filtered) return;
    path = filtered.path;
    driver = filtered.filter;
  }
  const key = drivers.get(driver ?? '') ?? [...drivers.values()].join('`, `');
  return yield* new GitActionRejectedError({
    reason: 'UNSUPPORTED_CONFIGURATION',
    detail: `\`${path}\` goes through the filter that \`${key}\` runs. Porcelain does not run conversion filters, so it cannot check the content it would commit or stash. Run this action from a terminal instead.`,
  });
});

const filterAttributes = Effect.fn('Git.filterAttributes')(function* (
  process: GitProcessRunner,
  paths: string,
): Effect.fn.Return<
  { path: string; filter: string }[],
  ActionFailure,
  ActionPlatform
> {
  return parseFilterAttributes(
    yield* readActionCommand(
      process,
      ['check-attr', '-z', '--stdin', 'filter'],
      paths,
    ),
  );
});
