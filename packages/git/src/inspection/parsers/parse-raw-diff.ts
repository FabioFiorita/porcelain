import { Effect } from 'effect';
import { InvalidGitDiffError } from '../../shared/errors/invalid-git-diff-error.ts';
import { isOid } from '../../shared/parsers/oid.ts';

export type RawDiffEntry = {
  status: string;
  oldMode: string;
  newMode: string;
  oldPath: string;
  newPath: string;
};

export type RawDiffObjects = RawDiffEntry & {
  oldOid: string;
  newOid: string;
};

const META = /^:([0-7]{6}) ([0-7]{6}) ([0-9a-f]+) ([0-9a-f]+) ([A-Z])\d*$/u;

export const parseRawDiffEffect = Effect.fn('Git.parseRawDiff')(function* (
  output: Buffer,
  start: number = 0,
) {
  const { entries, end } = yield* readEntries(output, start);
  return {
    entries: entries.map(({ status, oldMode, newMode, oldPath, newPath }) => ({
      status,
      oldMode,
      newMode,
      oldPath,
      newPath,
    })),
    end,
  };
});

const parseRawDiffObjectsEffect = Effect.fn('Git.parseRawDiffObjects')(
  function* (output: Buffer) {
    const { entries, end } = yield* readEntries(output, 0);
    if (end !== output.length)
      return yield* Effect.fail(new InvalidGitDiffError());
    for (const entry of entries)
      if (!isOid(entry.oldOid) || !isOid(entry.newOid))
        return yield* Effect.fail(new InvalidGitDiffError());
    return entries;
  },
);

const readEntries = Effect.fn('Git.readRawDiffEntries')(function* (
  output: Buffer,
  start: number,
) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const entries: RawDiffObjects[] = [];
  let at = start;
  const field = Effect.fn('Git.rawDiffField')(function* () {
    const end = output.indexOf(0, at);
    if (end === -1) return yield* Effect.fail(new InvalidGitDiffError());
    const value = yield* Effect.try({
      try: () => decoder.decode(output.subarray(at, end)),
      catch: () => new InvalidGitDiffError(),
    });
    at = end + 1;
    return value;
  });
  const recordStart = () => {
    const code = output[at];
    const nextCode = output[at + 1];
    return code === 0x3a || (code === 0x0a && nextCode === 0x3a);
  };
  while (at < output.length && recordStart()) {
    const code = output[at];
    if (code === 0x0a) at += 1;
    const meta = META.exec(yield* field());
    if (!meta) return yield* Effect.fail(new InvalidGitDiffError());
    const [
      ,
      oldMode = '',
      newMode = '',
      oldOid = '',
      newOid = '',
      status = '',
    ] = meta;
    const oldPath = yield* field();
    const newPath = status === 'R' || status === 'C' ? yield* field() : oldPath;
    entries.push({
      status,
      oldMode,
      newMode,
      oldOid,
      newOid,
      oldPath,
      newPath,
    });
  }
  if (entries.length > 0 && output[at] === 0) at += 1;
  return { entries, end: at };
});

export function parseRawDiff(
  output: Buffer,
  start: number = 0,
): { entries: RawDiffEntry[]; end: number } {
  return Effect.runSync(parseRawDiffEffect(output, start));
}

export function parseRawDiffObjects(output: Buffer): RawDiffObjects[] {
  return Effect.runSync(parseRawDiffObjectsEffect(output));
}
