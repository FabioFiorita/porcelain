import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readInventory } from '@porcelain/client/projects';
import {
  readReviewGitSettingsView,
  reviewGitSettingsTrust,
} from '@porcelain/client/preferences';
import { specsApart } from '@porcelain/client/preferences/rules';
import { type Connection } from '@/shared/workspace/connection';

export function useReviewGitSettings(connection: Connection) {
  return useAtomValue(readReviewGitSettingsView(connection));
}

export function useSpecsApart(connection: Connection) {
  return specsApart(useReviewGitSettings(connection));
}

export function useReviewGitSettingsTrust(connection: Connection) {
  return useAtomValue(reviewGitSettingsTrust(connection));
}

export function useGitHubAccountProjects(connection: Connection) {
  const result = useAtomValue(readInventory(connection));
  return {
    projects: Option.getOrUndefined(AsyncResult.value(result))?.projects,
    failed: AsyncResult.isFailure(result),
  };
}
