import { Context } from 'effect';

export type EditAnnouncement = {
  worktreeId: string;
  paths: readonly string[];
};

export interface EditAnnouncementWriter {
  announce(input: EditAnnouncement): void;
}

export const EditAnnouncementWriter = Context.Service<
  '@porcelain/server/EditAnnouncementWriter',
  EditAnnouncementWriter
>('@porcelain/server/EditAnnouncementWriter');
