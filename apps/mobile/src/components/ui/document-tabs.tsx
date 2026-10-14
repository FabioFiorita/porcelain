import { Pressable, ScrollView, View } from 'react-native';
import { IconButton } from './icon-button';
import { Text } from './text';
import {
  activateDocument,
  closeDocument,
  type DocumentTabsState,
} from '../../shared/rules/document-tabs';

type DocumentTab = {
  key: string;
  title: string;
  label?: string;
  closable?: boolean;
};

export function DocumentTabs<T extends DocumentTab>({
  documents,
  onChange,
  onSelect,
  onOpenToSide,
  label = 'Open documents',
  focused = true,
}: {
  documents: DocumentTabsState<T>;
  onChange: (
    update: (state: DocumentTabsState<T>) => DocumentTabsState<T>,
  ) => void;
  onSelect: () => void;
  onOpenToSide?: (document: T) => void;
  label?: string;
  focused?: boolean;
}) {
  const { tabs, active } = documents;
  return (
    <ScrollView
      horizontal
      className={
        focused && tabs.length > 0
          ? 'min-h-12 min-w-0 max-h-14 flex-1 border-b-2 border-ring'
          : 'min-h-12 min-w-0 max-h-14 flex-1 border-b-2 border-transparent'
      }
      contentContainerClassName="min-h-12 items-center gap-1 px-2"
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={label}
    >
      {tabs.length === 0 ? (
        <Text variant="caption" tone="muted">
          No open tabs
        </Text>
      ) : null}
      {tabs.map((tab) => (
        <View
          key={tab.key}
          className={
            tab.key === active
              ? 'flex-row items-center rounded-2xl bg-accent'
              : 'flex-row items-center rounded-2xl'
          }
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={tab.label ?? tab.title}
            accessibilityState={{ selected: tab.key === active }}
            className="min-h-11 max-w-64 justify-center px-3 active:opacity-80"
            onPress={() => {
              onChange((state) => activateDocument(state, tab.key));
              onSelect();
            }}
          >
            <Text variant="ui" weight="medium" numberOfLines={1}>
              {tab.title}
            </Text>
          </Pressable>
          {tab.key === active && onOpenToSide ? (
            <IconButton
              icon="split"
              accessibilityLabel={`Open ${tab.label ?? tab.title} to the side`}
              onPress={() => onOpenToSide(tab)}
            />
          ) : null}
          {tab.closable !== false ? (
            <IconButton
              icon="close"
              accessibilityLabel={`Close ${tab.label ?? tab.title}`}
              onPress={() => onChange((state) => closeDocument(state, tab.key))}
            />
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}
