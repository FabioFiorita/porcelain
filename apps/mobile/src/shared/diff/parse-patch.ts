import { parsePatch } from 'diff/lib/patch/parse.js';

export function parseFilePatch(patch: string) {
  try {
    const files = parsePatch(patch).map((file) => ({
      oldFileName: file.oldFileName,
      newFileName: file.newFileName,
      isCreate: file.isCreate,
      isDelete: file.isDelete,
      isBinary: file.isBinary,
      hunks: file.hunks.map((hunk) => ({
        oldStart: hunk.oldStart,
        newStart: hunk.newStart,
        oldLines: hunk.oldLines,
        newLines: hunk.newLines,
        lines: hunk.lines,
      })),
    }));
    return files.length ? files : undefined;
  } catch {
    return undefined;
  }
}
