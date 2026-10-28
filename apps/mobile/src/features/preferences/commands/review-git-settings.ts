import { useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import { readServiceUpdate } from '@porcelain/client/access';
import {
  refreshReviewGitSettings,
  reviewGitSettingsSaving,
  saveReviewGitSettings,
} from '@porcelain/client/preferences';
import type { RuntimeConnection } from '@porcelain/client/transport';

export function useReviewGitSettingsCommands(connection: RuntimeConnection) {
  const { saving, failure, kept } = useAtomValue(
    reviewGitSettingsSaving(connection),
  );
  const save = useAtomSet(saveReviewGitSettings(connection));
  const readAgain = useAtomSet(refreshReviewGitSettings(connection));
  const checkTrustAgain = useAtomRefresh(readServiceUpdate(connection));
  return {
    saving,
    failure,
    kept,
    save,
    readAgain: () => readAgain(undefined),
    checkTrustAgain,
  };
}
