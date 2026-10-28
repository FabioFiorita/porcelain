import { useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import { readServiceUpdate } from '@porcelain/client/access';
import {
  refreshReviewGitSettings,
  reviewGitSettingsSaving,
  saveReviewGitSettings,
} from '@porcelain/client/preferences';
import { type Connection } from '@/shared/workspace/connection';

export function useReviewGitSettingsCommands(connection: Connection) {
  return {
    ...useAtomValue(reviewGitSettingsSaving(connection)),
    save: useAtomSet(saveReviewGitSettings(connection)),
    readAgain: useAtomSet(refreshReviewGitSettings(connection)),
    checkTrustAgain: useAtomRefresh(readServiceUpdate(connection)),
  };
}
