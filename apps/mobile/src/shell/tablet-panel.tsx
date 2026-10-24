import { BottomSheet, RNHostView } from '@expo/ui';
import type { ReactNode } from 'react';
import { Box } from '../components/ui/box';
import { IconButton } from '../components/ui/icon-button';
import type { IconName } from '../components/ui/icon';
import { Text } from '../components/ui/text';
import type { InspectorMode } from '../shared/rules/workspace-documents';

export type PanelEntry = {
  readonly mode: InspectorMode;
  readonly title: string;
  readonly icon: IconName;
};

export function panelEntries(reviewTitle: string): readonly PanelEntry[] {
  return [
    { mode: 'files', title: 'Files', icon: 'files' },
    { mode: 'review', title: reviewTitle, icon: 'checklist' },
    { mode: 'history', title: 'History', icon: 'history' },
  ];
}

export function PanelButtons({
  entries,
  mode,
  open,
  onPress,
}: {
  entries: readonly PanelEntry[];
  mode: InspectorMode;
  open: boolean;
  onPress: (mode: InspectorMode) => void;
}) {
  return entries.map((entry) => (
    <IconButton
      key={entry.mode}
      icon={entry.icon}
      variant={open && entry.mode === mode ? 'outline' : 'ghost'}
      accessibilityLabel={`${entry.title} panel`}
      expanded={open && entry.mode === mode}
      testID={`panel-${entry.mode}`}
      onPress={() => onPress(entry.mode)}
    />
  ));
}

export function TabletRail({
  entries,
  mode,
  open,
  onPress,
  onToggle,
}: {
  entries: readonly PanelEntry[];
  mode: InspectorMode;
  open: boolean;
  onPress: (mode: InspectorMode) => void;
  onToggle: () => void;
}) {
  return (
    <Box
      className="w-13 items-center justify-between"
      paddingY={1}
      accessibilityRole="toolbar"
      accessibilityLabel="Panels"
    >
      <Box className="items-center" gap={1}>
        <PanelButtons
          entries={entries}
          mode={mode}
          open={open}
          onPress={onPress}
        />
      </Box>
      <IconButton
        icon="panel"
        accessibilityLabel={open ? 'Hide panel' : 'Show panel'}
        onPress={onToggle}
      />
    </Box>
  );
}

export function PanelHeader({
  title,
  onClose,
}: {
  title: string;
  onClose?: (() => void) | undefined;
}) {
  return (
    <Box
      className="h-13 flex-row items-center justify-between"
      paddingX={4}
      divider="bottom"
    >
      <Text variant="subheading" weight="semibold" numberOfLines={1}>
        {title}
      </Text>
      {onClose ? (
        <IconButton
          icon="close"
          accessibilityLabel={`Close ${title}`}
          onPress={onClose}
        />
      ) : null}
    </Box>
  );
}

export function DockedPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Box
      className="w-80"
      surface="panel"
      accessibilityLabel={`${title} panel content`}
    >
      <PanelHeader title={title} />
      {children}
    </Box>
  );
}

export function PanelSheet({
  title,
  presented,
  onClose,
  children,
}: {
  title: string;
  presented: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <BottomSheet
      isPresented={presented}
      onDismiss={onClose}
      contentPadding={0}
      snapPoints={['full']}
    >
      {presented ? (
        <RNHostView>
          <Box className="flex-1" surface="background">
            <PanelHeader title={title} onClose={onClose} />
            {children}
          </Box>
        </RNHostView>
      ) : null}
    </BottomSheet>
  );
}
