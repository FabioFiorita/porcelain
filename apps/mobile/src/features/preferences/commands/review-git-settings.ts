import { useAtomSet, useAtomValue } from '@effect/atom-react';
import {
  refreshReviewGitSettings,
  reviewGitSettingsSaving,
  saveReviewGitSettings,
} from '@porcelain/client/preferences';
import type { RuntimeConnection } from '@porcelain/client/transport';

export function useReviewGitSettingsCommands(connection: RuntimeConnection) {
  const { saving, failure } = useAtomValue(reviewGitSettingsSaving(connection));
  const save = useAtomSet(saveReviewGitSettings(connection));
  const readAgain = useAtomSet(refreshReviewGitSettings(connection));
  return { saving, failure, save, readAgain: () => readAgain(undefined) };
}
