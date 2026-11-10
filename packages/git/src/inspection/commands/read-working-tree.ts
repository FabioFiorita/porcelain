import type { GitDiffResult } from '../dtos/git-diff.ts';
import { Effect, FileSystem, Path } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { gitRead, type GitReadOptions } from '../../shared/commands/run-git.ts';
import { parseDiff } from '../parsers/parse-diff.ts';
import { checkConversionFilters } from './check-conversion-filters.ts';

export const readWorkingTree = Effect.fn('Git.readWorkingTree')(function* (
  checkout: string,
  baseOid: string | undefined,
  limits: GitLimits,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const folder = yield* fs.makeTempDirectoryScoped({
    prefix: 'porcelain-tree-',
  });
  const read = (args: readonly string[], options: GitReadOptions = {}) =>
    gitRead(checkout, args, limits, options);
  const headOid = (yield* read(['rev-parse', 'HEAD'])).toString('utf8').trim();
  const headTreeOid = (yield* read(['rev-parse', `${headOid}^{tree}`]))
    .toString('utf8')
    .trim();
  const filters = yield* checkConversionFilters(checkout, limits, true);
  const status = yield* read([
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
  ]);
  let treeOid = headTreeOid;
  let storage: GitReadOptions['storage'];
  if (status.length > 0) {
    const index = (yield* read([
      'rev-parse',
      '--path-format=absolute',
      '--git-path',
      'index',
    ]))
      .toString('utf8')
      .trim();
    const objects = (yield* read([
      'rev-parse',
      '--path-format=absolute',
      '--git-path',
      'objects',
    ]))
      .toString('utf8')
      .trim();
    storage = {
      indexFile: path.join(folder, 'index'),
      objectDirectory: path.join(folder, 'objects'),
      alternateObjectDirectory: objects,
    };
    yield* fs.makeDirectory(storage.objectDirectory);
    if (yield* fs.exists(index)) yield* fs.copyFile(index, storage.indexFile);
    else yield* read(['read-tree', 'HEAD'], { storage });
    yield* read(['add', '--all', '--', ':/'], {
      storage,
      config: [
        ...filters,
        'core.hooksPath=/dev/null',
        'core.splitIndex=false',
        'maintenance.auto=false',
        'gc.auto=0',
      ],
    });
    treeOid = (yield* read(['write-tree'], {
      storage,
      config: ['core.splitIndex=false'],
    }))
      .toString('utf8')
      .trim();
  }
  if (baseOid === undefined)
    return {
      treeOid,
      headOid,
      headTreeOid,
      patch: '',
      omittedFiles: [],
      sections: new Map<string, GitDiffResult>(),
    };
  const output = yield* read(
    [
      'diff-tree',
      '-r',
      '--no-commit-id',
      '--no-ext-diff',
      '--no-textconv',
      '--no-color',
      `--find-renames=${limits.renames.similarityPercent}%`,
      '--diff-algorithm=myers',
      '--no-indent-heuristic',
      `--unified=${limits.inspection.contextLines}`,
      '--src-prefix=a/',
      '--dst-prefix=b/',
      '--no-relative',
      '--raw',
      '-z',
      '--patch',
      baseOid,
      treeOid,
      '--',
    ],
    {
      ...(storage === undefined ? {} : { storage }),
      maxBytes: limits.inspection.diffBatchBytes,
    },
  );
  const sections = yield* parseDiff(output, limits);
  return {
    treeOid,
    headOid,
    headTreeOid,
    patch: [...sections.values()]
      .flatMap((section) => ('patch' in section ? [section.patch] : []))
      .join(''),
    omittedFiles: [...sections].flatMap(([paths, section]) =>
      section.kind === 'omitted' ? [paths.split('\0').at(-1)!] : [],
    ),
    sections,
  };
}, Effect.scoped);
