import { PreferencesPage } from './preferences-page';
import { archiveSettings } from '@porcelain/client/preferences/rules';
import { Box } from '../../../components/ui/box';
import { Item } from '../../../components/ui/item';
import { Switch } from '../../../components/ui/switch';
import { Text } from '../../../components/ui/text';
import { PreferenceChoice } from './preference-choice';
import { CommitModelSetting } from './commit-model-setting';

export function ReviewsGitSettings() {
  return (
    <PreferencesPage>
      {({ preferences, disabled, setPreferences }) => (
        <>
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
                    onCheckedChange={(value) =>
                      setPreferences({ [key]: value })
                    }
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
        </>
      )}
    </PreferencesPage>
  );
}
