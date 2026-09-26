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

const drafts = new WeakMap<object, Map<string, RetainedDraft>>();
export function retainedFileDrafts(connection: object) {
  let entries = drafts.get(connection);
  if (!entries) {
    entries = new Map();
    drafts.set(connection, entries);
  }
  return entries;
}
