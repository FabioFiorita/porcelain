import { Context, type Effect } from 'effect';

type EditAnnouncement = {
  worktreeId: string;
  paths: readonly string[];
};

export interface EditAnnouncementWriter {
  announce(input: EditAnnouncement): Effect.Effect<void>;
}

export const EditAnnouncementWriter = Context.Service<
  '@porcelain/server/EditAnnouncementWriter',
  EditAnnouncementWriter
>('@porcelain/server/EditAnnouncementWriter');
