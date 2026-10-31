import { lazy, Suspense } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '../../../components/ui/box';
import { SettingsCategories } from './settings-categories';
import { SettingsAbout } from './settings-about';

const DevelopmentSettingsSection = __DEV__
  ? lazy(() => import('./development-settings'))
  : () => null;

export function SettingsScreen({
  onOpenGeneral,
  onOpenReviewsGit,
  onOpenComputers,
  onOpenComponentLibrary,
}: {
  onOpenGeneral: () => void;
  onOpenReviewsGit: () => void;
  onOpenComputers: () => void;
  onOpenComponentLibrary: () => void;
}) {
  return (
    <ScrollView
      className="flex-1 bg-frame"
      contentContainerClassName="grow"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Box className="w-full max-w-2xl flex-1 self-center" gap={6} padding={4}>
        <SettingsCategories
          onOpenGeneral={onOpenGeneral}
          onOpenReviewsGit={onOpenReviewsGit}
          onOpenComputers={onOpenComputers}
        />
        {__DEV__ ? (
          <Suspense fallback={null}>
            <DevelopmentSettingsSection
              onOpenComponentLibrary={onOpenComponentLibrary}
            />
          </Suspense>
        ) : null}
        <Box className="flex-1" />
        <SettingsAbout />
      </Box>
    </ScrollView>
  );
}
