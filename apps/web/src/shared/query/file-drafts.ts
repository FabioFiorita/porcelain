import type { FileDraft } from '@/features/review/index';

const drafts = new WeakMap<object, Map<string, FileDraft>>();
export function retainedFileDrafts(connection: object) {
  let entries = drafts.get(connection);
  if (!entries) {
    entries = new Map();
    drafts.set(connection, entries);
  }
  return entries;
}
