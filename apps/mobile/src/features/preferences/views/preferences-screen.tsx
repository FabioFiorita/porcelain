import { ScrollView, View } from 'react-native';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { Item } from '../../../components/ui/item';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import type { Preferences } from '../../../shared/rules/preferences';
import { usePreferences } from '../store';

function Choice<T extends string | boolean>({
  label,
  description,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: T;
  options: readonly { value: T; label: string; id: string }[];
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <Item title={label} description={description} variant="outline">
      <View className="flex-row flex-wrap gap-2 pt-2">
        {options.map((option) => (
          <Button
            key={option.id}
            testID={option.id}
            label={option.label}
            accessibilityLabel={`${label}: ${option.label}${value === option.value ? ', selected' : ''}`}
            variant={value === option.value ? 'secondary' : 'ghost'}
            disabled={disabled}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </Item>
  );
}

export function PreferencesScreen() {
  const { preferences, status, error, read, setPreferences } = usePreferences();
  const disabled = status !== 'ready';
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View className="gap-6 px-6 py-8">
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
        <Choice<Preferences['theme']>
          label="Theme"
          description="System follows your device’s appearance."
          value={preferences.theme}
          options={[
            { value: 'system', label: 'System', id: 'theme-system' },
            { value: 'light', label: 'Light', id: 'theme-light' },
            { value: 'dark', label: 'Dark', id: 'theme-dark' },
          ]}
          disabled={disabled}
          onChange={(theme) => setPreferences({ theme })}
        />
        <View className="gap-3">
          <Text variant="subheading" tone="muted">
            Code
          </Text>
          <Choice<boolean>
            label="Long lines"
            description="Wrap keeps every line visible without scrolling."
            value={preferences.wrapLongLines}
            options={[
              { value: true, label: 'Wrap', id: 'lines-wrap' },
              { value: false, label: 'Scroll', id: 'lines-scroll' },
            ]}
            disabled={disabled}
            onChange={(wrapLongLines) => setPreferences({ wrapLongLines })}
          />
        </View>
        <View className="gap-3">
          <Text variant="subheading" tone="muted">
            Documents
          </Text>
          <Choice<Preferences['markdownDefault']>
            label="Markdown opens as"
            description="You can switch per file."
            value={preferences.markdownDefault}
            options={[
              { value: 'reader', label: 'Reader', id: 'markdown-reader' },
              { value: 'source', label: 'Source', id: 'markdown-source' },
            ]}
            disabled={disabled}
            onChange={(markdownDefault) => setPreferences({ markdownDefault })}
          />
          <Choice<Preferences['htmlDefault']>
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
        </View>
      </View>
    </ScrollView>
  );
}
