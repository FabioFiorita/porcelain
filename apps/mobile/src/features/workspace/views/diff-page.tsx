import { useState, type ReactNode } from 'react';
import { FlatList, View, type FlatListProps } from 'react-native';
import { Box } from '../../../components/ui/box';
import { DiffView } from '../../../components/ui/diff-view';
import {
  PageHeader,
  type DocumentAction,
} from '../../../components/ui/document-header';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { ListDetail } from '../../../components/ui/list-detail';
import { Loading } from '../../../components/ui/loading';
import { documentHeading } from '../../../shared/rules/document-heading';
import { usePreferences } from '../../preferences/index';
import {
  diffCountsLabel,
  diffPageRows,
  fileAtTop,
  headingRow,
  type DiffPageBody,
  type DiffPageFile,
  type DiffPageRow,
} from '../rules/diff-page';

export type { DiffPageFile } from '../rules/diff-page';

export type DiffPageState =
  | { kind: 'loading' }
  | { kind: 'failed'; retry: () => void }
  | DiffPageBody;

export type DiffPagePartProps<F extends DiffPageFile> = {
  file: F;
  index: number;
  part: DiffPageRow['kind'];
  onOpen: () => void;
};

const MENU_FILES = 100;

type Viewable = Parameters<
  NonNullable<FlatListProps<DiffPageRow>['onViewableItemsChanged']>
>[0];

export function DiffPage<F extends DiffPageFile>({
  title,
  subtitle,
  header,
  files,
  empty,
  initialFile,
  part,
  onOpenFile,
}: {
  title: string;
  subtitle?: string | undefined;
  header: (current: F | undefined) => ReactNode;
  files: readonly F[];
  empty: ReactNode;
  initialFile?: string | undefined;
  part: (props: DiffPagePartProps<F>) => ReactNode;
  onOpenFile: (file: F) => void;
}) {
  const initial = files.findIndex((file) => file.key === initialFile);
  const [current, setCurrent] = useState(Math.max(initial, 0));
  const [list, setList] = useState<FlatList<DiffPageRow> | null>(null);
  const [beside, setBeside] = useState(false);
  const [pending, setPending] = useState<number>();
  const [onViewable] = useState(() => ({ viewableItems }: Viewable) => {
    const top = fileAtTop(
      viewableItems.flatMap((item) =>
        typeof item.index === 'number' ? [item.index] : [],
      ),
    );
    if (top !== undefined) setCurrent(top);
  });
  const jump = (index: number) => {
    setCurrent(index);
    setPending(headingRow(index));
    list?.scrollToIndex({ index: headingRow(index), animated: false });
  };
  const rows = diffPageRows(files.length);
  const sticky = rows.flatMap((row, index) =>
    row.kind === 'heading' ? [index] : [],
  );
  const filesAction: DocumentAction = {
    kind: 'choice',
    id: 'files',
    label: 'Files',
    icon: 'files',
    choices: files.slice(0, MENU_FILES).map((file, index) => ({
      label: fileLabel(file),
      selected: index === current,
      onPress: () => jump(index),
    })),
  };
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={beside || files.length < 2 ? [] : [filesAction]}
      />
      <ListDetail
        collapse="detail"
        list={() => (
          <DiffPageFiles
            files={files}
            current={current}
            onSelect={jump}
            onShown={setBeside}
          />
        )}
        detail={
          <FlatList
            ref={setList}
            className="flex-1 bg-background"
            data={rows}
            extraData={[files, pending]}
            keyExtractor={(row) => `${row.kind}:${files[row.file]?.key ?? ''}`}
            ListHeaderComponent={<>{header(files[current])}</>}
            ListEmptyComponent={<>{empty}</>}
            stickyHeaderIndices={sticky}
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            windowSize={9}
            {...(initial > 0
              ? { initialScrollIndex: headingRow(initial) }
              : {})}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            onViewableItemsChanged={onViewable}
            onScrollToIndexFailed={(info) =>
              list?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: false,
              })
            }
            renderItem={({ item, index }) => {
              const file = files[item.file];
              if (!file) return null;
              const content = part({
                file,
                index: item.file,
                part: item.kind,
                onOpen: () => onOpenFile(file),
              });
              return (
                <View
                  collapsable={false}
                  {...(index === pending
                    ? {
                        onLayout: () => {
                          setPending(undefined);
                          list?.scrollToIndex({ index, animated: false });
                        },
                      }
                    : {})}
                >
                  {content}
                </View>
              );
            }}
          />
        }
      />
    </>
  );
}

function DiffPageFiles<F extends DiffPageFile>({
  files,
  current,
  onSelect,
  onShown,
}: {
  files: readonly F[];
  current: number;
  onSelect: (index: number) => void;
  onShown: (shown: boolean) => void;
}) {
  return (
    <FlatList
      ref={(list) => {
        if (!list) return;
        onShown(true);
        return () => onShown(false);
      }}
      className="flex-1 bg-background"
      data={files}
      extraData={current}
      keyExtractor={(file) => file.key}
      renderItem={({ item, index }) => {
        const { title, subtitle } = documentHeading(item.path, item.details);
        return (
          <Item
            size="compact"
            title={title}
            titleNumberOfLines={1}
            {...(subtitle ? { description: subtitle } : {})}
            descriptionNumberOfLines={1}
            selected={index === current}
            accessibilityLabel={`Go to ${fileLabel(item)}`}
            onPress={() => onSelect(index)}
          />
        );
      }}
    />
  );
}

export function DiffPagePart({
  file,
  part,
  state,
  onOpen,
}: {
  file: DiffPageFile;
  part: DiffPageRow['kind'];
  state: DiffPageState;
  onOpen: () => void;
}) {
  return part === 'heading' ? (
    <DiffPageHeading file={file} state={state} onOpen={onOpen} />
  ) : (
    <DiffPageContent state={state} onOpen={onOpen} />
  );
}

function DiffPageHeading({
  file,
  state,
  onOpen,
}: {
  file: DiffPageFile;
  state: DiffPageState;
  onOpen: () => void;
}) {
  const counts =
    state.kind === 'loading' || state.kind === 'failed'
      ? undefined
      : diffCountsLabel(state);
  const { title, subtitle } = documentHeading(file.path, [
    ...file.details,
    counts,
  ]);
  return (
    <Box surface="background" divider="bottom">
      <Item
        size="compact"
        title={title}
        titleNumberOfLines={1}
        {...(subtitle ? { description: subtitle } : {})}
        descriptionNumberOfLines={1}
        trailing={<Icon name="chevron" tone="muted" />}
        accessibilityLabel={`Open ${fileLabel(file)}${counts ? `, ${counts}` : ''}`}
        onPress={onOpen}
      />
    </Box>
  );
}

function DiffPageContent({
  state,
  onOpen,
}: {
  state: DiffPageState;
  onOpen: () => void;
}) {
  const { preferences } = usePreferences();
  switch (state.kind) {
    case 'loading':
      return <Loading label="Loading diff…" />;
    case 'failed':
      return (
        <Box padding={4}>
          <ErrorState
            message="Couldn't load diff"
            retry={{ label: 'Retry', onPress: state.retry }}
          />
        </Box>
      );
    case 'notice':
      return (
        <Item
          size="compact"
          title={state.title}
          description="Open the file to see this change."
          onPress={onOpen}
        />
      );
    case 'large':
      return (
        <Item
          size="compact"
          title={`Large diff · ${state.lines.toLocaleString()} lines`}
          description="Open the file to read it."
          onPress={onOpen}
        />
      );
    case 'lines':
      return (
        <View collapsable={false}>
          <DiffView
            lines={state.lines}
            wrap={preferences.lineOverflow === 'wrap'}
            fit
          />
        </View>
      );
  }
}

function fileLabel(file: DiffPageFile) {
  return [file.path, ...file.details].filter(Boolean).join(' · ');
}
