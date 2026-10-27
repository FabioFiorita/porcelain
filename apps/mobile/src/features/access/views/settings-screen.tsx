import { lazy, Suspense } from 'react';
import { ScrollView } from 'react-native';
import {
  generalSettingsSummary,
  REVIEWS_GIT_SETTINGS_SUMMARY,
} from '@porcelain/client/preferences/rules';
import {
  computersSummary,
  settingsUpdateCount,
} from '@porcelain/client/access';
import { Box } from '../../../components/ui/box';
import { Card } from '../../../components/ui/card';
import { Icon } from '../../../components/ui/icon';
import { IconTile } from '../../../components/ui/icon-tile';
import { Item } from '../../../components/ui/item';
import { Separator } from '../../../components/ui/separator';
import { Text } from '../../../components/ui/text';
import { usePreferences } from '../../preferences';
import { useServiceUpdates } from '../queries/service-updates';
import { useEnvironments, useEnvironmentStorageStatus } from '../store';
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
  const storage = useEnvironmentStorageStatus();
  const { preferences } = usePreferences();
  const { targets } = useServiceUpdates();
  const computers = computersSummary(
    remotes.length,
    settingsUpdateCount(targets),
  );
  const paired = {
    loading: 'Reading saved computers…',
    unreadable: 'Saved computers could not be read',
    ready: computers.paired,
  }[storage.status];
  return (
    <ScrollView
      className="flex-1 bg-frame"
      contentContainerClassName="grow"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Box className="w-full max-w-2xl flex-1 self-center" gap={6} padding={4}>
        <Card>
          <Item
            testID="settings-general"
            title="General"
            description={generalSettingsSummary(preferences)}
            accessibilityLabel={`General, ${generalSettingsSummary(preferences)}`}
            leading={<IconTile name="sliders" />}
            trailing={<Icon name="chevron" tone="muted" />}
            onPress={onOpenGeneral}
          />
          <Separator />
          <Item
            testID="settings-reviews-git"
            title="Reviews & Git"
            description={REVIEWS_GIT_SETTINGS_SUMMARY}
            accessibilityLabel={`Reviews & Git, ${REVIEWS_GIT_SETTINGS_SUMMARY}`}
            leading={<IconTile name="checklist" />}
            trailing={<Icon name="chevron" tone="muted" />}
            onPress={onOpenReviewsGit}
          />
        </Card>
        <Box gap={2}>
          <Card>
            <Item
              testID="settings-computers"
              title="Computers"
              accessibilityLabel={['Computers', paired, computers.updates]
                .filter(Boolean)
                .join(', ')}
              leading={<IconTile name="environments" />}
              trailing={<Icon name="chevron" tone="muted" />}
              onPress={onOpenComputers}
            >
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {paired}
                {computers.updates ? (
                  <>
                    {' · '}
                    <Text variant="caption" tone="brand" weight="medium">
                      {computers.updates}
                    </Text>
                  </>
                ) : null}
              </Text>
            </Item>
          </Card>
          <Box paddingX={4}>
            <Text variant="caption" tone="muted">
              Porcelain shows the worktrees of every paired computer together.
              Pair a computer, check its connection or update it here.
            </Text>
          </Box>
        </Box>
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
