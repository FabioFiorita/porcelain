import { PreferencesPage } from './preferences-page';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import type { Preferences } from '@porcelain/client/preferences';
import { PreferenceChoice } from './preference-choice';

export function PreferencesScreen() {
  return (
    <PreferencesPage>
      {({ preferences, disabled, setPreferences }) => (
        <>
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
          <Box gap={3}>
            <Text variant="subheading" tone="muted">
              Code
            </Text>
            <PreferenceChoice<boolean>
              label="Long lines"
              description="Wrap keeps every line visible without scrolling."
              value={preferences.lineOverflow === 'wrap'}
              options={[
                { value: true, label: 'Wrap', id: 'lines-wrap' },
                { value: false, label: 'Scroll', id: 'lines-scroll' },
              ]}
              disabled={disabled}
              onChange={(wrapLongLines) =>
                setPreferences({
                  lineOverflow: wrapLongLines ? 'wrap' : 'scroll',
                })
              }
            />
          </Box>
          <Box gap={3}>
            <Text variant="subheading" tone="muted">
              Documents
            </Text>
            <PreferenceChoice<Preferences['markdownDefault']>
              label="Markdown opens as"
              description="You can switch per file."
              value={preferences.markdownDefault}
              options={[
                { value: 'reader', label: 'Reader', id: 'markdown-reader' },
                { value: 'source', label: 'Source', id: 'markdown-source' },
              ]}
              disabled={disabled}
              onChange={(markdownDefault) =>
                setPreferences({ markdownDefault })
              }
            />
            <PreferenceChoice<Preferences['htmlDefault']>
              label="HTML opens as"
              description="Previews run in a sandbox with no access to Porcelain."
              value={preferences.htmlDefault}
              options={[
                { value: 'preview', label: 'Preview', id: 'html-preview' },
                { value: 'source', label: 'Source', id: 'html-source' },
              ]}
              disabled={disabled}
              onChange={(htmlDefault) => setPreferences({ htmlDefault })}
            />
          </Box>
        </>
      )}
    </PreferencesPage>
  );
}
