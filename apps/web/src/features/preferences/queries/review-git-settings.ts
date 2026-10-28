import { useAtomValue } from '@effect/atom-react';
import { readInventory } from '@porcelain/client/projects';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import { readReviewGitSettingsView } from '@porcelain/client/preferences';
import { specsApart } from '@porcelain/client/preferences/rules';
import { type Connection } from '@/shared/workspace/connection';

export function useReviewGitSettings(connection: Connection) {
  return useAtomValue(readReviewGitSettingsView(connection));
}

export function useSpecsApart(connection: Connection) {
  return specsApart(useReviewGitSettings(connection));
}

export function useGitHubAccountProjects(connection: Connection) {
  return useConfirmedRead(readInventory(connection)).value.projects;
}
