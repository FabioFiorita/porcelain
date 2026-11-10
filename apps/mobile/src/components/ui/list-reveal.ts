import { useState } from 'react';
import type { FlatList } from 'react-native';

type Scroller = Pick<FlatList<unknown>, 'scrollToIndex' | 'scrollToOffset'>;

function listReveal() {
  let list: Scroller | null = null;
  let shown: number | undefined;
  let visible = new Set<number>();
  return {
    attach(next: Scroller | null, index: number) {
      list = next;
      if (!next || index < 0 || index === shown) return;
      shown = index;
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
          animated: true,
        });
      },
    },
  };
}

export function useListReveal() {
  const [reveal] = useState(listReveal);
  return reveal;
}
