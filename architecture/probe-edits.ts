import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProbeEdit } from './probe.ts';

export function edited(text: string, edit: ProbeEdit): string {
  if (edit.kind === 'append') return text + edit.content;
  if (edit.kind === 'prepend') return edit.content + text;
  if (edit.kind !== 'replace') return text;
  if (!text.includes(edit.old))
    throw new Error(
      `${edit.path} no longer holds the text the probe replaces: ${JSON.stringify(edit.old.slice(0, 80))}`,
    );
  return edit.all
    ? text.replaceAll(edit.old, edit.new)
    : text.replace(edit.old, edit.new);
}

export function preflightEdits(
  edits: readonly ProbeEdit[],
  read: (path: string) => string | undefined,
): void {
  const virtual = new Map<string, string | undefined>();
  for (const edit of edits) {
    const text = virtual.has(edit.path)
      ? virtual.get(edit.path)
      : read(edit.path);
    if (edit.kind === 'create') {
      if (text !== undefined)
        throw new Error(`${edit.path} already exists; the probe creates it.`);
      virtual.set(edit.path, edit.content);
    } else {
      if (text === undefined)
        throw new Error(`${edit.path} no longer exists; the probe edits it.`);
      virtual.set(
        edit.path,
        edit.kind === 'delete' ? undefined : edited(text, edit),
      );
    }
  }
}

export function preflightAt(root: string, edits: readonly ProbeEdit[]): void {
  preflightEdits(edits, (path) => {
    const file = join(root, path);
    return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
  });
}
