import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  documentTabLayout,
  type DocumentTabBounds,
} from '../../shared/rules/document-tab-layout';
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
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState({ width: 0, height: 0 });
  const [bounds, setBounds] = useState<ReadonlyMap<string, DocumentTabBounds>>(
    () => new Map(),
  );
  const activeBounds = active ? bounds.get(active) : undefined;
  const { overflow } = documentTabLayout(viewport, content.width, 0);
  useEffect(() => {
    const next = documentTabLayout(
      viewport,
      content.width,
      offset.current,
      activeBounds,
    );
    scroll.current?.scrollTo({ x: next.offset, animated: false });
    offset.current = next.offset;
  }, [viewport, content.width, activeBounds]);

  if (tabs.length === 0)
    return (
      <View
        className="min-h-12 min-w-0 flex-1 justify-center px-2"
        accessibilityRole="tablist"
        accessibilityLabel={label}
      >
        <Text variant="caption" tone="muted">
          No open tabs
        </Text>
      </View>
    );

  return (
    <ScrollView
      ref={scroll}
      horizontal
      className="min-h-12 min-w-0 flex-1"
      style={{ height: content.height || undefined }}
      contentContainerClassName="min-h-12 items-center gap-1 px-2 pb-1"
      onLayout={({ nativeEvent: { layout } }) => setViewport(layout.width)}
      onContentSizeChange={(width, height) => setContent({ width, height })}
      onScroll={({ nativeEvent }) => {
        offset.current = nativeEvent.contentOffset.x;
      }}
      scrollEventThrottle={16}
      scrollEnabled={overflow}
      showsHorizontalScrollIndicator={overflow}
      showsVerticalScrollIndicator={false}
      alwaysBounceHorizontal={false}
      alwaysBounceVertical={false}
      contentInsetAdjustmentBehavior="never"
      accessibilityRole="tablist"
      accessibilityLabel={label}
    >
      {tabs.map((tab) => (
        <View
          key={tab.key}
          onLayout={({ nativeEvent: { layout } }) =>
            setBounds(
              (current) =>
                new Map(
                  tabs.flatMap((entry) => {
                    const value =
                      entry.key === tab.key ? layout : current.get(entry.key);
                    return value ? [[entry.key, value] as const] : [];
                  }),
                ),
            )
          }
          className={
            tab.key === active
              ? focused
                ? 'flex-row items-center rounded-2xl border-b-2 border-ring bg-accent'
                : 'flex-row items-center rounded-2xl border-b-2 border-transparent bg-accent'
              : 'flex-row items-center rounded-2xl border-b-2 border-transparent'
          }
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={tab.label ?? tab.title}
            accessibilityState={{ selected: tab.key === active }}
            className="min-h-11 max-w-64 justify-center px-3 py-2 active:opacity-80"
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
