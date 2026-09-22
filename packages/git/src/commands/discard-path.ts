import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';
import { readActionCommand } from './read-action-command.ts';

export async function discardPath(
  process: GitProcessRunner,
  command: GitActionCommand,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const intent = command.intent;
  if (intent.action !== 'discard') throw new Error('Invalid discard action');
  if (intent.hunk) {
    const diff = await readActionCommand(
      process,
      [
        '--literal-pathspecs',
        'diff',
        ...(intent.hunk.scope === 'staged' ? ['--cached'] : []),
        '--no-ext-diff',
        '--no-textconv',
        '--unified=0',
        '--',
        intent.path,
      ],
      signal,
    );
    const selection = selectedHunk(diff, intent.hunk);
    if (selection === 'partial')
      throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
        detail:
          'The selected lines cover only part of a change. Select the whole change to discard it.',
      });
    if (!selection) throw new GitActionRejectedError('CHANGED_SINCE_LOOKED');
    const recovery =
      intent.hunk.scope === 'staged'
        ? JSON.stringify({
            porcelainDiscard: 1,
            cached: selection,
            unstaged: '',
            zero: true,
          })
        : selection;
    const created = await process.execute(
      ['hash-object', '-w', '--stdin'],
      signal,
      recovery,
    );
    const createFailure = processFailure(created);
    if (createFailure) return createFailure;
    const restoreStashOid = created.stdout.toString('utf8').trimEnd();
    const safetyRef = `refs/porcelain/discarded/${command.id}`;
    const saved = await process.execute(
      ['update-ref', safetyRef, restoreStashOid, '0'.repeat(40)],
      signal,
    );
    const saveFailure = processFailure(saved);
    if (saveFailure) return saveFailure;
    const applied = await process.execute(
      [
        'apply',
        '--reverse',
        ...(intent.hunk.scope === 'staged' ? ['--index'] : []),
        '--unidiff-zero',
        '--whitespace=nowarn',
        '-',
      ],
      signal,
      selection,
    );
    const applyFailure = processFailure(applied);
    if (applyFailure) return applyFailure;
    return {
      state: 'succeeded',
      result: { restoreStashOid, stashRetained: true },
      refreshRequired: true,
    };
  }
  const status = await readActionCommand(
    process,
    [
      '--literal-pathspecs',
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all',
    ],
    signal,
  );
  const records = status.split('\0');
  let renamedFrom: string | undefined;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] ?? '';
    const rename = /^[RC]|^.[RC]/.test(record);
    if (record.slice(3) === intent.path && rename) {
      renamedFrom = records[index + 1];
      break;
    }
    if (rename) index += 1;
  }
  if (renamedFrom) {
    const paths = [renamedFrom, intent.path];
    const cached = await readActionCommand(
      process,
      [
        '--literal-pathspecs',
        'diff',
        '--cached',
        '--binary',
        '--full-index',
        '--',
        ...paths,
      ],
      signal,
    );
    const unstaged = await readActionCommand(
      process,
      [
        '--literal-pathspecs',
        'diff',
        '--binary',
        '--full-index',
        '--',
        ...paths,
      ],
      signal,
    );
    const recovery = JSON.stringify({
      porcelainDiscard: 1,
      cached,
      unstaged,
    });
    const restoreStashOid = await saveRecoveryBlob(
      process,
      command.id,
      recovery,
      signal,
    );
    for (const args of [
      [
        '--literal-pathspecs',
        'restore',
        '--source=HEAD',
        '--staged',
        '--worktree',
        '--',
        renamedFrom,
      ],
      [
        '--literal-pathspecs',
        'rm',
        '-f',
        '--cached',
        '--ignore-unmatch',
        '--',
        intent.path,
      ],
      ['--literal-pathspecs', 'clean', '-f', '--', intent.path],
    ]) {
      const reverted = await process.execute(args, signal);
      const failure = processFailure(reverted);
      if (failure) return failure;
    }
    return {
      state: 'succeeded',
      result: { restoreStashOid, stashRetained: true, restoreIndex: true },
      refreshRequired: true,
    };
  }
  const paths = [intent.path];
  const saved = await process.execute(
    [
      '--literal-pathspecs',
      'stash',
      'push',
      '--include-untracked',
      '--message',
      `Porcelain discarded ${intent.path}`,
      '--',
      ...paths,
    ],
    signal,
  );
  const failure = processFailure(saved);
  if (failure) return failure;
  if (/No local changes to save/i.test(saved.stdout.toString('utf8')))
    return { state: 'no-change', refreshRequired: false };
  const restoreStashOid = (
    await readActionCommand(
      process,
      ['rev-parse', '--verify', 'refs/stash'],
      signal,
    )
  ).trimEnd();
  return {
    state: 'succeeded',
    result: {
      stashOid: restoreStashOid,
      stashRetained: true,
      restoreStashOid,
      restoreIndex: true,
    },
    refreshRequired: true,
  };
}

async function saveRecoveryBlob(
  process: GitProcessRunner,
  requestId: string,
  content: string,
  signal: AbortSignal,
): Promise<string> {
  const created = await process.execute(
    ['hash-object', '-w', '--stdin'],
    signal,
    content,
  );
  const createFailure = processFailure(created);
  if (createFailure)
    throw new GitActionRejectedError(createFailure.reason ?? 'GIT_REJECTED');
  const oid = created.stdout.toString('utf8').trimEnd();
  const saved = await process.execute(
    [
      'update-ref',
      `refs/porcelain/discarded/${requestId}`,
      oid,
      '0'.repeat(40),
    ],
    signal,
  );
  const saveFailure = processFailure(saved);
  if (saveFailure)
    throw new GitActionRejectedError(saveFailure.reason ?? 'GIT_REJECTED');
  return oid;
}

function selectedHunk(
  diff: string,
  range: { startLine: number; endLine: number },
): string | 'partial' | null {
  const lines = diff.split(/(?<=\n)/);
  const firstHunk = lines.findIndex((line) => line.startsWith('@@ '));
  if (firstHunk < 0) return null;
  // A selected hunk no longer represents the whole-file blob ids printed by
  // `git diff`; retaining the index line would make recovery reject the other
  // hunks that were deliberately left in place.
  const header = lines
    .slice(0, firstHunk)
    .filter((line) => !line.startsWith('index '));
  let selected: string | null = null;
  for (let index = firstHunk; index < lines.length; ) {
    const next = lines.findIndex(
      (line, candidate) => candidate > index && line.startsWith('@@ '),
    );
    const end = next < 0 ? lines.length : next;
    const match = lines[index]?.match(
      /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/,
    );
    if (match) {
      const start = Number(match[1]);
      const count = Number(match[2] ?? 1);
      const last = start + Math.max(count, 1) - 1;
      if (range.startLine <= last && range.endLine >= start) {
        if (range.startLine !== start || range.endLine !== last)
          return 'partial';
        if (selected) return 'partial';
        selected = [...header, ...lines.slice(index, end)].join('');
      }
    }
    index = end;
  }
  return selected;
}
