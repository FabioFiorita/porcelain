import { ScrollView } from 'react-native';
import { archiveSettings } from '@porcelain/client/preferences/rules';
import { Box } from '../../../components/ui/box';
import { ErrorState } from '../../../components/ui/error-state';
import { Item } from '../../../components/ui/item';
import { Loading } from '../../../components/ui/loading';
import { Switch } from '../../../components/ui/switch';
import { Text } from '../../../components/ui/text';
import { usePreferences } from '../store';
import { PreferenceChoice } from './preference-choice';
import { CommitModelSetting } from './commit-model-setting';

export function ReviewsGitSettings() {
  const { preferences, status, error, read, setPreferences } = usePreferences();
  const disabled = status !== 'ready';
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Box
        className="w-full max-w-2xl self-center"
        gap={6}
        paddingX={6}
        paddingY={8}
      >
        {status === 'loading' ? (
          <Loading label="Reading saved preferences…" />
        ) : null}
        {error ? (
          <ErrorState
            message={error}
            retry={{
              label: 'Read saved preferences again',
              onPress: () => read(undefined),
            }}
          />
        ) : null}
        <Box gap={3}>
          <Text variant="subheading">When archiving a review</Text>
          {archiveSettings.map(({ key, label }) => (
            <Item
              key={key}
              title={label}
              variant="outline"
              trailing={
                <Switch
                  label={label}
                  checked={preferences[key]}
                  disabled={disabled}
                  onCheckedChange={(value) => setPreferences({ [key]: value })}
                />
              }
            />
          ))}
        </Box>
        <Box gap={3}>
          <Text variant="subheading">Git</Text>
          <PreferenceChoice
            label="Pull strategy"
            description="Used when pulling changes. Saved on this device."
            value={preferences.pullStrategy}
            options={[
              { value: 'merge', label: 'Merge', id: 'pull-merge' },
              { value: 'rebase', label: 'Rebase', id: 'pull-rebase' },
            ]}
            disabled={disabled}
            onChange={(pullStrategy) => setPreferences({ pullStrategy })}
          />
          <CommitModelSetting />
        </Box>
      </Box>
    </ScrollView>
  );
}
