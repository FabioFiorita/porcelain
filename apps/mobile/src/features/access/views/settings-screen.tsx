import { lazy, Suspense } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '../../../components/ui/box';
import { Card } from '../../../components/ui/card';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { Separator } from '../../../components/ui/separator';
import { useEnvironments } from '../store';
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
  const remotes = useEnvironments();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="grow"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Box className="w-full max-w-2xl flex-1 self-center" gap={6} padding={4}>
        <Card>
          <Item
            testID="settings-general"
            title="General"
            description="Theme, code and documents"
            leading={<Icon name="settings" />}
            trailing={<Icon name="chevron" tone="muted" />}
            onPress={onOpenGeneral}
          />
          <Separator />
          <Item
            testID="settings-reviews-git"
            title="Reviews & Git"
            description="Archiving, pull and commit model"
            leading={<Icon name="review" />}
            trailing={<Icon name="chevron" tone="muted" />}
            onPress={onOpenReviewsGit}
          />
        </Card>
        <Card>
          <Item
            testID="settings-computers"
            title="Computers"
            description={`${remotes.length} paired`}
            leading={<Icon name="environments" />}
            trailing={<Icon name="chevron" tone="muted" />}
            onPress={onOpenComputers}
          />
        </Card>
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
