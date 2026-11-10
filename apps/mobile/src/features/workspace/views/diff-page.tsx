import { useState, type ReactNode } from 'react';
import { useAtomSet, useAtomValue } from '@effect/atom-react';
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
import { sourceLanguage } from '../../../shared/rules/highlight-code';
import { usePreferences } from '../../preferences/index';
import {
  diffCountsLabel,
  diffPageRows,
  fileAtTop,
  stuckHeading,
  headingRow,
  type DiffPageBody,
  type DiffPageFile,
  type DiffPageRow,
} from '../rules/diff-page';
import { diffPageCurrent, diffPageStuck } from '../store';

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
  page,
  title,
  subtitle,
  header,
  files,
  empty,
  initialFile,
  part,
  onOpenFile,
}: {
  page: string;
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
  const setCurrent = useAtomSet(diffPageCurrent(page));
  const setStuck = useAtomSet(diffPageStuck(page));
  const [list, setList] = useState<FlatList<DiffPageRow> | null>(null);
  const [beside, setBeside] = useState(false);
  const [pending, setPending] = useState(
    initial > 0 ? headingRow(initial) : undefined,
  );
  const [onViewable] = useState(() => ({ viewableItems }: Viewable) => {
    const visible = viewableItems.flatMap((item) =>
      typeof item.index === 'number' ? [item.index] : [],
    );
    const top = fileAtTop(visible);
    if (top !== undefined) setCurrent(top);
    setStuck(stuckHeading(visible));
  });
  const jump = (index: number) => {
    setCurrent(index);
    setPending(headingRow(index));
    list?.scrollToIndex({ index: headingRow(index), animated: false });
  };
  const aim = (index: number) =>
    requestAnimationFrame(() =>
      list?.scrollToIndex({ index, animated: false }),
    );
  const rows = diffPageRows(files.length);
  const filesAction: DocumentAction = {
    kind: 'choice',
    id: 'files',
    label: 'Files',
    icon: 'files',
    choices: files.slice(0, MENU_FILES).map((file, index) => ({
      label: fileLabel(file),
      selected: false,
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
            page={page}
            files={files}
            onSelect={jump}
            onShown={setBeside}
          />
        )}
        detail={
          <View className="flex-1" collapsable={false}>
            <FlatList
              ref={setList}
              className="flex-1 bg-background"
              contentInsetAdjustmentBehavior="automatic"
              data={rows}
              extraData={[files, pending]}
              keyExtractor={(row) =>
                `${row.kind}:${files[row.file]?.key ?? ''}`
              }
              ListHeaderComponent={
                <DiffPageHeader page={page} files={files} header={header} />
              }
              ListEmptyComponent={<>{empty}</>}
              initialNumToRender={6}
              maxToRenderPerBatch={2}
              removeClippedSubviews={false}
              windowSize={9}
              {...(pending === undefined
                ? { maintainVisibleContentPosition: { minIndexForVisible: 0 } }
                : {})}
              onViewableItemsChanged={onViewable}
              onScrollBeginDrag={() => setPending(undefined)}
              onContentSizeChange={() => {
                if (pending !== undefined) aim(pending);
              }}
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
                          onLayout: () => aim(index),
                        }
                      : {})}
                  >
                    {content}
                  </View>
                );
              }}
            />
            <PinnedHeading
              page={page}
              files={files}
              part={part}
              onOpenFile={onOpenFile}
            />
          </View>
        }
      />
    </>
  );
}

function DiffPageHeader<F extends DiffPageFile>({
  page,
  files,
  header,
}: {
  page: string;
  files: readonly F[];
  header: (current: F | undefined) => ReactNode;
}) {
  const current = useAtomValue(diffPageCurrent(page));
  return <>{header(files[current])}</>;
}

function PinnedHeading<F extends DiffPageFile>({
  page,
  files,
  part,
  onOpenFile,
}: {
  page: string;
  files: readonly F[];
  part: (props: DiffPagePartProps<F>) => ReactNode;
  onOpenFile: (file: F) => void;
}) {
  const stuck = useAtomValue(diffPageStuck(page));
  const file = stuck === undefined ? undefined : files[stuck];
  if (!file || stuck === undefined) return null;
  return (
    <View className="absolute inset-x-0 top-0" collapsable={false}>
      {part({
        file,
        index: stuck,
        part: 'heading',
        onOpen: () => onOpenFile(file),
      })}
    </View>
  );
}

function DiffPageFiles<F extends DiffPageFile>({
  page,
  files,
  onSelect,
  onShown,
}: {
  page: string;
  files: readonly F[];
  onSelect: (index: number) => void;
  onShown: (shown: boolean) => void;
}) {
  const current = useAtomValue(diffPageCurrent(page));
  return (
    <FlatList
      ref={(list) => {
        if (!list) return;
        onShown(true);
        return () => onShown(false);
      }}
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
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
    <DiffPageContent path={file.path} state={state} onOpen={onOpen} />
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
  path,
  state,
  onOpen,
}: {
  path: string;
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
            language={sourceLanguage(path)}
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
