import { PreferencesPage } from './preferences-page';
import { Box } from '../../../components/ui/box';
import { GroupHeader } from '../../../components/ui/group-header';
import { Text } from '../../../components/ui/text';
import type { Preferences } from '@porcelain/client/preferences';
import { PreferenceChoice } from './preference-choice';

export function PreferencesScreen() {
  return (
    <PreferencesPage>
      {({ preferences, disabled, setPreferences }) => (
        <>
          <Box>
            <GroupHeader variant="section" label="Appearance" />
            <PreferenceChoice<Preferences['appearance']>
              label="Theme"
              description="System follows your device’s appearance."
              value={preferences.appearance}
              options={[
                { value: 'system', label: 'System', id: 'theme-system' },
                { value: 'light', label: 'Light', id: 'theme-light' },
                { value: 'dark', label: 'Dark', id: 'theme-dark' },
              ]}
              disabled={disabled}
              onChange={(theme) => setPreferences({ appearance: theme })}
            />
          </Box>
          <Box>
            <GroupHeader variant="section" label="Code" />
            <PreferenceChoice<boolean>
              label="Long lines"
              description="Wrap keeps every line visible without scrolling."
              value={preferences.lineOverflow === 'wrap'}
              options={[
                { value: false, label: 'Scroll', id: 'lines-scroll' },
                { value: true, label: 'Wrap', id: 'lines-wrap' },
              ]}
              disabled={disabled}
              onChange={(wrapLongLines) =>
                setPreferences({
                  lineOverflow: wrapLongLines ? 'wrap' : 'scroll',
                })
              }
            />
          </Box>
          <Box>
            <GroupHeader variant="section" label="Documents" />
            <PreferenceChoice<Preferences['documentsDefault']>
              label="Documents open as"
              description="Markdown and HTML. You can switch per file; HTML previews run in a sandbox with no access to Porcelain."
              value={preferences.documentsDefault}
              options={[
                {
                  value: 'rendered',
                  label: 'Rendered',
                  id: 'documents-rendered',
                },
                { value: 'source', label: 'Source', id: 'documents-source' },
              ]}
              disabled={disabled}
              onChange={(documentsDefault) =>
                setPreferences({ documentsDefault })
              }
            />
          </Box>
          <Text variant="caption" tone="muted">
            These preferences are saved on this device.
          </Text>
        </>
      )}
    </PreferencesPage>
  );
}
