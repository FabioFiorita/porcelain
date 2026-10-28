import { useAtomValue } from '@effect/atom-react';
import {
  readReviewGitSettingsView,
  reviewGitSettingsTrust,
} from '@porcelain/client/preferences';
import type { RuntimeConnection } from '@porcelain/client/transport';

export function useReviewGitSettings(connection: RuntimeConnection) {
  return useAtomValue(readReviewGitSettingsView(connection));
}

export function useReviewGitSettingsTrust(connection: RuntimeConnection) {
  return useAtomValue(reviewGitSettingsTrust(connection));
}
