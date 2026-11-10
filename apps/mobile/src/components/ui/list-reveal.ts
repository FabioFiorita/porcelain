import { useState } from 'react';
import type { FlatList } from 'react-native';

type Scroller = Pick<FlatList<unknown>, 'scrollToIndex' | 'scrollToOffset'>;

const REVEAL_RETRIES = 6;

function listReveal() {
  let list: Scroller | null = null;
  let shown: number | undefined;
  let visible = new Set<number>();
  let retries = 0;
  return {
    attach(next: Scroller | null, index: number) {
      list = next;
      if (!next || index < 0 || index === shown) return;
      shown = index;
      retries = 0;
      if (!visible.has(index))
        next.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    },
    props: {
      viewabilityConfig: { itemVisiblePercentThreshold: 100 },
      onViewableItemsChanged: ({
        viewableItems,
      }: {
        viewableItems: readonly { index?: number | null | undefined }[];
      }) => {
        visible = new Set(
          viewableItems.flatMap((item) =>
            typeof item.index === 'number' ? [item.index] : [],
          ),
        );
      },
      onScrollToIndexFailed: (info: {
        index: number;
        averageItemLength: number;
      }) => {
        list?.scrollToOffset({
          offset: info.index * info.averageItemLength,
          animated: false,
        });
        if (retries >= REVEAL_RETRIES) return;
        retries += 1;
        requestAnimationFrame(() => {
          if (shown === info.index && !visible.has(info.index))
            list?.scrollToIndex({
              index: info.index,
              viewPosition: 0.5,
              animated: false,
            });
        });
      },
    },
  };
}

export function useListReveal() {
  const [reveal] = useState(listReveal);
  return reveal;
}
