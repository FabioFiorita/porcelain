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
import { Card, CardRows } from '../../../components/ui/card';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { Text } from '../../../components/ui/text';
import { usePreferences } from '../../preferences';
import { useServiceUpdates } from '../queries/service-updates';
import { useEnvironments, useEnvironmentStorageStatus } from '../store';
import { SettingsAbout } from './settings-about';
import { DemoControls } from './demo-controls';

const DevelopmentSettingsSection = __DEV__
  ? lazy(() => import('./development-settings'))
  : () => null;

export function SettingsScreen({
  onOpenGeneral,
  onOpenReviewsGit,
  onOpenComputers,
  onOpenComponentLibrary,
  onOpenShortcuts,
  selected,
}: {
  selected?: 'general' | 'reviews-git' | 'computers' | undefined;
  onOpenGeneral: () => void;
  onOpenReviewsGit: () => void;
  onOpenComputers: () => void;
  onOpenComponentLibrary: () => void;
  onOpenShortcuts?: (() => void) | undefined;
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
    loading: '',
    unreadable: 'Saved computers could not be read',
    ready: computers.paired,
  }[storage.status];
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="grow"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Box className="w-full max-w-2xl flex-1 self-center" gap={6} padding={4}>
        <CardRows>
          <Item
            testID="settings-general"
            title="General"
            description={generalSettingsSummary(preferences)}
            accessibilityLabel={`General, ${generalSettingsSummary(preferences)}`}
            leading={<Icon name="sliders" tone="muted" />}
            trailing={<Icon name="chevron" tone="muted" />}
            selected={selected === 'general'}
            onPress={onOpenGeneral}
          />
          <Item
            testID="settings-reviews-git"
            title="Changes & Git"
            description={REVIEWS_GIT_SETTINGS_SUMMARY}
            accessibilityLabel={`Changes & Git, ${REVIEWS_GIT_SETTINGS_SUMMARY}`}
            leading={<Icon name="checklist" tone="muted" />}
            trailing={<Icon name="chevron" tone="muted" />}
            selected={selected === 'reviews-git'}
            onPress={onOpenReviewsGit}
          />
          {onOpenShortcuts ? (
            <Item
              testID="settings-keyboard-shortcuts"
              title="Keyboard Shortcuts"
              leading={<Icon name="keyboard" tone="muted" />}
              trailing={<Icon name="chevron" tone="muted" />}
              onPress={onOpenShortcuts}
            />
          ) : null}
        </CardRows>
        <Box gap={2}>
          <Card>
            <Item
              testID="settings-computers"
              title="Computers"
              accessibilityLabel={['Computers', paired, computers.updates]
                .filter(Boolean)
                .join(', ')}
              leading={<Icon name="environments" tone="muted" />}
              trailing={<Icon name="chevron" tone="muted" />}
              selected={selected === 'computers'}
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
          <Text variant="caption" tone="muted">
            Porcelain shows the worktrees of every paired computer together.
            Pair a computer, check its connection or update it here.
          </Text>
        </Box>
        <DemoControls />
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
