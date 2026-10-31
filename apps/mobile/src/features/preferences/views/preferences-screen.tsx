import { PreferencesPage } from './preferences-page';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import type { Preferences } from '@porcelain/client/preferences';
import { PreferenceChoice } from './preference-choice';

export function PreferencesScreen({ inline = false }: { inline?: boolean }) {
  return (
    <PreferencesPage>
      {({ preferences, disabled, setPreferences }) => (
        <>
          {inline ? (
            <Box gap={2}>
              <Text variant="heading">
                <Text variant="heading" tone="muted">
                  Settings.
                </Text>{' '}
                General
              </Text>
              <Text>How Porcelain looks, and how code and documents open.</Text>
            </Box>
          ) : null}
          <Box gap={3}>
            <Text variant="subheading" tone="muted">
              Appearance
            </Text>
            <PreferenceChoice<Preferences['appearance']>
              inline={inline}
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
          <Box gap={3}>
            <Text variant="subheading" tone="muted">
              Code
            </Text>
            <PreferenceChoice<boolean>
              inline={inline}
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
          <Box gap={3}>
            <Text variant="subheading" tone="muted">
              Documents
            </Text>
            <PreferenceChoice<Preferences['documentsDefault']>
              inline={inline}
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
