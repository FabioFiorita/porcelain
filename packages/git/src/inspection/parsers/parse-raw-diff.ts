import { InvalidGitDiffError } from '../errors/invalid-git-diff-error.ts';

export type RawDiffEntry = {
  status: string;
  oldMode: string;
  newMode: string;
  oldPath: string;
  newPath: string;
};

const META = /^:([0-7]{6}) ([0-7]{6}) [0-9a-f]+ [0-9a-f]+ ([A-Z])\d*$/u;

export function parseRawDiff(
  output: Buffer,
  start = 0,
): { entries: RawDiffEntry[]; end: number } {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const entries: RawDiffEntry[] = [];
  let at = start;
  const field = () => {
    const end = output.indexOf(0, at);
    if (end === -1) throw new InvalidGitDiffError();
    let value: string;
    try {
      value = decoder.decode(output.subarray(at, end));
    } catch {
      throw new InvalidGitDiffError();
    }
    at = end + 1;
    return value;
  };
  const recordStart = () => {
    const code = output[at];
    const nextCode = output[at + 1];
    return code === 0x3a || (code === 0x0a && nextCode === 0x3a);
  };
  while (at < output.length && recordStart()) {
    const code = output[at];
    if (code === 0x0a) at += 1;
    const meta = META.exec(field());
    if (!meta) throw new InvalidGitDiffError();
    const [, oldMode = '', newMode = '', status = ''] = meta;
    const oldPath = field();
    const newPath = status === 'R' || status === 'C' ? field() : oldPath;
    entries.push({ status, oldMode, newMode, oldPath, newPath });
  }
  if (entries.length > 0 && output[at] === 0) at += 1;
  return { entries, end: at };
}
