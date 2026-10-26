import { useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  documentTabLayout,
  type DocumentTabBounds,
} from '../../shared/rules/document-tab-layout';
import { Icon, type IconName } from './icon';
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

type PinnedTab = {
  title: string;
  icon: IconName;
  detail?: string | undefined;
  selected: boolean;
  onPress: () => void;
};

export function DocumentTabs<T extends DocumentTab>({
  documents,
  onChange,
  onSelect,
  onOpenToSide,
  label = 'Open documents',
  focused = true,
  pinned,
}: {
  documents: DocumentTabsState<T>;
  onChange: (
    update: (state: DocumentTabsState<T>) => DocumentTabsState<T>,
  ) => void;
  onSelect: () => void;
  onOpenToSide?: (document: T) => void;
  label?: string;
  focused?: boolean;
  pinned?: PinnedTab | undefined;
}) {
  const { tabs, active } = documents;
  const [offset, setOffset] = useState(0);
  const [scrolledFor, setScrolledFor] = useState<{
    viewport: number;
    width: number;
    bounds: DocumentTabBounds | undefined;
  }>();
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState({ width: 0, height: 0 });
  const [bounds, setBounds] = useState<ReadonlyMap<string, DocumentTabBounds>>(
    () => new Map(),
  );
  const [pinnedBounds, setPinnedBounds] = useState<DocumentTabBounds>();
  const activeBounds = pinned?.selected
    ? pinnedBounds
    : active
      ? bounds.get(active)
      : undefined;
  const { overflow } = documentTabLayout(viewport, content.width, 0);

  return (
    <ScrollView
      ref={(scroll: ComponentRef<typeof ScrollView> | null) => {
        if (
          !scroll ||
          (scrolledFor?.viewport === viewport &&
            scrolledFor.width === content.width &&
            scrolledFor.bounds === activeBounds)
        )
          return;
        const next = documentTabLayout(
          viewport,
          content.width,
          offset,
          activeBounds,
        );
        scroll.scrollTo({ x: next.offset, animated: false });
        setScrolledFor({
          viewport,
          width: content.width,
          bounds: activeBounds,
        });
      }}
      horizontal
      className="min-h-12 min-w-0 flex-1"
      style={{ height: content.height || undefined }}
      contentContainerClassName="min-h-12 items-center gap-1"
      onLayout={({ nativeEvent: { layout } }) => setViewport(layout.width)}
      onContentSizeChange={(width, height) => setContent({ width, height })}
      onScroll={({ nativeEvent }) => {
        setOffset(nativeEvent.contentOffset.x);
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
      {pinned ? (
        <View
          onLayout={({ nativeEvent: { layout } }) => setPinnedBounds(layout)}
          className={
            pinned.selected
              ? `flex-row items-center rounded-lg border bg-muted ${focused ? 'border-border' : 'border-transparent'}`
              : 'flex-row items-center rounded-lg border border-transparent'
          }
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={
              pinned.detail
                ? `${pinned.title}, ${pinned.detail} decisions reviewed`
                : pinned.title
            }
            accessibilityState={{ selected: pinned.selected }}
            className="min-h-11 flex-row items-center gap-2 px-3 active:opacity-80"
            onPress={pinned.onPress}
          >
            <Icon
              name={pinned.icon}
              tone={pinned.selected ? 'default' : 'muted'}
            />
            <Text
              variant="ui"
              weight="medium"
              tone={pinned.selected ? 'default' : 'muted'}
              numberOfLines={1}
            >
              {pinned.title}
            </Text>
            {pinned.detail ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {pinned.detail}
              </Text>
            ) : null}
          </Pressable>
        </View>
      ) : null}
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
              ? `flex-row items-center rounded-lg border bg-muted ${focused ? 'border-border' : 'border-transparent'}`
              : 'flex-row items-center rounded-lg border border-transparent'
          }
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={tab.label ?? tab.title}
            accessibilityState={{ selected: tab.key === active }}
            className="min-h-11 max-w-45 justify-center px-3 active:opacity-80"
            onPress={() => {
              onChange((state) => activateDocument(state, tab.key));
              onSelect();
            }}
          >
            <Text
              variant="ui"
              weight="medium"
              tone={tab.key === active ? 'default' : 'muted'}
              numberOfLines={1}
            >
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
          {tab.key === active && tab.closable !== false ? (
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
