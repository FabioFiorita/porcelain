import { useState, type ComponentRef } from 'react';
import { useHeaderHeight } from 'expo-router/react-navigation';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
} from 'react-native';

type Scroller = ComponentRef<typeof ScrollView>;
type Row = ComponentRef<typeof View>;

const BOTTOM_MARGIN = 96;

function scrollReveal() {
  let scroller: Scroller | null = null;
  let offset: number | undefined;
  let height = 0;
  let shown: Row | null = null;
  return {
    scroller: {
      ref: (node: Scroller | null) => {
        scroller = node;
      },
      onLayout: (event: LayoutChangeEvent) => {
        height = event.nativeEvent.layout.height;
      },
      onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        offset = event.nativeEvent.contentOffset.y;
      },
      scrollEventThrottle: 32,
    },
    row: (node: Row | null, header: number) => {
      const content = scroller?.getInnerViewRef();
      if (!node || node === shown || !scroller || !content) return;
      shown = node;
      const list = scroller;
      const current = offset ?? -header;
      node.measureLayout(content, (_, top, __, rowHeight) => {
        if (top < current + header)
          list.scrollTo({ y: top - header, animated: true });
        else if (top + rowHeight > current + height - BOTTOM_MARGIN)
          list.scrollTo({
            y: top + rowHeight - height + BOTTOM_MARGIN,
            animated: true,
          });
      });
    },
  };
}

export function useScrollReveal() {
  const [reveal] = useState(scrollReveal);
  const header = useHeaderHeight();
  return {
    scroller: reveal.scroller,
    row: (node: Row | null) => reveal.row(node, header),
  };
}
