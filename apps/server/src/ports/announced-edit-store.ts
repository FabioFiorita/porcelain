export type AnnouncedEdit = {
  worktreeId: string;
  paths: readonly string[];
};

export interface AnnouncedEditStore {
  save(input: AnnouncedEdit): void;
}
