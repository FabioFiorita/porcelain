export type EditAnnouncement = {
  worktreeId: string;
  paths: readonly string[];
};

export interface EditAnnouncementWriter {
  announce(input: EditAnnouncement): void;
}
