import { useAtomSet, useAtomValue } from '@effect/atom-react';
import {
  refreshReviewGitSettings,
  refreshReviewGitSettingsTrust,
  reviewGitSettingsSaving,
  saveReviewGitSettings,
} from '@porcelain/client/preferences';
import { type Connection } from '@/shared/workspace/connection';

export function useReviewGitSettingsCommands(connection: Connection) {
  const checkTrustAgain = useAtomSet(refreshReviewGitSettingsTrust(connection));
  return {
    ...useAtomValue(reviewGitSettingsSaving(connection)),
    save: useAtomSet(saveReviewGitSettings(connection)),
    readAgain: useAtomSet(refreshReviewGitSettings(connection)),
    checkTrustAgain: () => checkTrustAgain(undefined),
  };
}
