import { parsePatch } from 'diff/lib/patch/parse.js';
import { useState } from 'react';
import { FlatList, ScrollView, View, useWindowDimensions } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import {
  FILE_DIFF_INITIAL_ROWS,
  FILE_DIFF_WINDOW_SIZE,
} from '../../config/limits';
import { diffRows, type DiffContent } from '../rules/patch';
import { DiffLine } from './diff-line';

export function FileDiff({
  content,
  path,
}: {
  content: DiffContent;
  path?: string;
}) {
  const rows = diffRows(content, parsePatch, path);
  const { fontScale } = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const surface = useResolveClassNames(
    'min-h-0 flex-1 overflow-hidden bg-card',
  );
  const gutterWidth = rows.reduce(
    (width, row) =>
      Math.max(
        width,
        Math.max(
          String(row.oldLine ?? '').length,
          String(row.newLine ?? '').length,
        ) *
          8 *
          fontScale +
          16,
      ),
    40 * fontScale,
  );
  const width = rows.reduce(
    (width, row) =>
      Math.max(
        width,
        row.text.replaceAll('\t', '        ').length * 14 * fontScale +
          gutterWidth * 2 +
          52 * fontScale,
      ),
    viewport.width,
  );
  return (
    <View
      testID="file-diff"
      style={surface}
      onLayout={({ nativeEvent: { layout } }) =>
        setViewport((current) =>
          current.width === layout.width && current.height === layout.height
            ? current
            : { width: layout.width, height: layout.height },
        )
      }
    >
      {viewport.height > 0 && viewport.width > 0 ? (
        <ScrollView
          horizontal
          testID="file-diff-horizontal"
          style={{ width: viewport.width, height: viewport.height }}
          contentContainerStyle={{ width, height: viewport.height }}
          directionalLockEnabled
        >
          <FlatList
            testID="file-diff-viewport"
            accessibilityLabel={path ? `Diff for ${path}` : 'File diff'}
            style={{ width, height: viewport.height }}
            data={rows}
            keyExtractor={(row) => row.id}
            renderItem={({ item }) => (
              <DiffLine row={item} gutterWidth={gutterWidth} />
            )}
            initialNumToRender={FILE_DIFF_INITIAL_ROWS}
            windowSize={FILE_DIFF_WINDOW_SIZE}
          />
        </ScrollView>
      ) : null}
    </View>
  );
}
