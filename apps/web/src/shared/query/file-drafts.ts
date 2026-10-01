import type { Connection } from '@/shared/workspace/connection';

type RetainedDraft = {
  snapshot: () => {
    owner: string | null;
    saving: boolean;
    text: string;
    savedText: string;
  };
  save: () => Promise<boolean>;
  claim: (owner: string) => boolean;
  release: (owner: string) => void;
};

const drafts = new Map<string, Map<string, RetainedDraft>>();
const connections = new Map<string, Connection>();

export function retainedFileDrafts(
  connection: Pick<Connection, 'environmentId'>,
) {
  let entries = drafts.get(connection.environmentId);
  if (!entries) {
    entries = new Map();
    drafts.set(connection.environmentId, entries);
  }
  return entries;
}

export function adoptFileDrafts(connection: Connection) {
  connections.set(connection.environmentId, connection);
}

export function draftConnection(connection: Connection): Connection {
  return connections.get(connection.environmentId) ?? connection;
}

export function hasUnsavedFileDrafts(environmentIds: readonly string[]) {
  return environmentIds.some((environmentId) =>
    [...(drafts.get(environmentId)?.values() ?? [])].some((draft) => {
      const state = draft.snapshot();
      return state.saving || state.text !== state.savedText;
    }),
  );
}

export async function saveFileDrafts(environmentId: string) {
  for (const draft of drafts.get(environmentId)?.values() ?? [])
    if (!(await draft.save())) return false;
  return true;
}

export function dropFileDrafts(environmentId: string) {
  drafts.delete(environmentId);
  connections.delete(environmentId);
}
