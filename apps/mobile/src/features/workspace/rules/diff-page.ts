import {
  omissionReason,
  type DiffContent,
} from '@porcelain/client/changes/rules';
import type { RenderLine } from '../../../shared/rules/render-model';
import { diffPresentation } from './diff-presentation';

const DIFF_PAGE_CHUNK = 20;
const INLINE_DIFF_LINES = 1000;

export type DiffPageFile = {
  key: string;
  path: string;
  details: readonly (string | undefined)[];
};

type DiffCounts = { added: number; removed: number };

export type DiffPageBody =
  | ({ kind: 'lines'; lines: readonly RenderLine[] } & DiffCounts)
  | ({ kind: 'large'; lines: number } & DiffCounts)
  | { kind: 'notice'; title: string };

export type DiffPageRow = { kind: 'heading' | 'body'; file: number };

function diffCounts(lines: readonly RenderLine[]): DiffCounts {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.kind === 'added') added += 1;
    if (line.kind === 'removed') removed += 1;
  }
  return { added, removed };
}

function linesBody(
  lines: readonly RenderLine[],
  limit = INLINE_DIFF_LINES,
): DiffPageBody {
  const counts = diffCounts(lines);
  return lines.length > limit
    ? { kind: 'large', lines: lines.length, ...counts }
    : { kind: 'lines', lines, ...counts };
}

export function diffBody(
  content: DiffContent,
  limit = INLINE_DIFF_LINES,
): DiffPageBody {
  if (content.kind === 'omitted')
    return { kind: 'notice', title: omissionReason(content.reason) };
  const presentation = diffPresentation(content);
  if (presentation.kind === 'notice')
    return { kind: 'notice', title: presentation.title };
  if (presentation.kind === 'metadata')
    return { kind: 'notice', title: 'Metadata only' };
  return linesBody(presentation.lines, limit);
}

export function sourceBody(
  source: string,
  limit = INLINE_DIFF_LINES,
): DiffPageBody {
  const text = source.replaceAll('\r\n', '\n');
  const rows = text.endsWith('\n') ? text.slice(0, -1) : text;
  if (rows === '') return { kind: 'notice', title: 'Empty file' };
  return linesBody(
    rows.split('\n').map((line, index) => ({
      id: String(index + 1),
      text: line,
      newLine: index + 1,
      kind: 'added' as const,
    })),
    limit,
  );
}

export function diffCountsLabel(body: DiffPageBody | undefined) {
  if (!body || body.kind === 'notice') return undefined;
  return `+${body.added} −${body.removed}`;
}

export function diffPageRows(files: number): DiffPageRow[] {
  return Array.from({ length: files }, (_, file) => [
    { kind: 'heading' as const, file },
    { kind: 'body' as const, file },
  ]).flat();
}

export function headingRow(file: number) {
  return file * 2;
}

export function fileAtTop(rows: readonly number[]): number | undefined {
  if (rows.length === 0) return undefined;
  return Math.floor(Math.min(...rows) / 2);
}

export function stuckHeading(rows: readonly number[]): number | undefined {
  if (rows.length === 0) return undefined;
  const top = Math.min(...rows);
  return top % 2 === 1 ? Math.floor(top / 2) : undefined;
}

export function diffChunk<T>(items: readonly T[], index: number): T[] {
  const start = Math.floor(index / DIFF_PAGE_CHUNK) * DIFF_PAGE_CHUNK;
  return items.slice(start, start + DIFF_PAGE_CHUNK);
}

export function openingFile(focused: number, reading: number, files: number) {
  if (focused >= 0) return focused;
  return reading < files ? reading : 0;
}

function fileName(path: string) {
  return path.split('/').at(-1) ?? path;
}

function sectionSuffix(
  file: DiffPageFile,
  siblings: readonly DiffPageFile[],
): string | undefined {
  if (siblings.length < 2) return undefined;
  const details = file.details.filter(Boolean);
  for (let length = 1; length <= details.length; length++) {
    const prefix = details.slice(0, length).join(' · ');
    const same = siblings.filter(
      (other) =>
        other.details.filter(Boolean).slice(0, length).join(' · ') === prefix,
    );
    if (same.length === 1) return prefix;
  }
  return details.join(' · ') || undefined;
}

export function fileMenuLabels(
  files: readonly DiffPageFile[],
  shown = files.length,
): string[] {
  const byPath = new Map<string, DiffPageFile[]>();
  const paths = new Map<string, Set<string>>();
  for (const file of files) {
    byPath.set(file.path, [...(byPath.get(file.path) ?? []), file]);
    const name = fileName(file.path);
    paths.set(name, (paths.get(name) ?? new Set()).add(file.path));
  }
  return files.slice(0, shown).map((file) => {
    const name = fileName(file.path);
    const title = (paths.get(name)?.size ?? 0) > 1 ? file.path : name;
    const suffix = sectionSuffix(file, byPath.get(file.path) ?? []);
    return suffix ? `${title} · ${suffix}` : title;
  });
}
