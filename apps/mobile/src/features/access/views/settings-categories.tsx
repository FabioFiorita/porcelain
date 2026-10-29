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
import {
  useEnvironments,
  useEnvironmentStorageStatus,
  type useSettingsCategory,
} from '../store';

export function SettingsCategories({
  category,
  onOpenGeneral,
  onOpenReviewsGit,
  onOpenComputers,
}: {
  category?: ReturnType<typeof useSettingsCategory>['category'];
  onOpenGeneral: () => void;
  onOpenReviewsGit: () => void;
  onOpenComputers: () => void;
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
  const Group = category ? Box : Card;
  return (
    <Box gap={6}>
      <Group>
        <Item
          testID="settings-general"
          selected={category === 'general'}
          title="General"
          description={generalSettingsSummary(preferences)}
          accessibilityLabel={`General, ${generalSettingsSummary(preferences)}`}
          leading={
            <Box
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <IconTile name="sliders" />
            </Box>
          }
          trailing={category ? undefined : <Icon name="chevron" tone="muted" />}
          onPress={onOpenGeneral}
        />
        <Separator />
        <Item
          testID="settings-reviews-git"
          selected={category === 'reviews-git'}
          title="Reviews & Git"
          description={REVIEWS_GIT_SETTINGS_SUMMARY}
          accessibilityLabel={`Reviews & Git, ${REVIEWS_GIT_SETTINGS_SUMMARY}`}
          leading={
            <Box
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <IconTile name="checklist" />
            </Box>
          }
          trailing={category ? undefined : <Icon name="chevron" tone="muted" />}
          onPress={onOpenReviewsGit}
        />
      </Group>
      <Box gap={2}>
        <Group>
          <Item
            testID="settings-computers"
            selected={category === 'computers'}
            title="Computers"
            accessibilityLabel={['Computers', paired, computers.updates]
              .filter(Boolean)
              .join(', ')}
            leading={
              <Box
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <IconTile name="environments" />
              </Box>
            }
            trailing={
              category ? undefined : <Icon name="chevron" tone="muted" />
            }
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
        </Group>
        <Box paddingX={4}>
          <Text variant="caption" tone="muted">
            Porcelain shows the worktrees of every paired computer together.
            Pair a computer, check its connection or update it here.
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
