import { useState } from 'react';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { IconButton } from '../../../components/ui/icon-button';
import { RichText } from '../../../components/ui/rich-text';
import { Sheet } from '../../../components/ui/sheet';
import { Text } from '../../../components/ui/text';
import { WorkspaceGate, type Workspace } from '../../projects/index';
import { useReadyWalkthrough } from '../queries/walkthrough';
import { EvidenceImage } from './walkthrough-evidence';

const unavailable = (
  <Empty
    title="Screenshot unavailable"
    description="The walkthrough changed. Open the screenshot again from its step."
  />
);

export function WalkthroughScreenshotSheet({
  workspace,
  run,
  step,
  index,
}: {
  workspace: string | undefined;
  run: string | undefined;
  step: string | undefined;
  index: string | undefined;
}) {
  return (
    <Sheet title="Screenshot" layout="fixed">
      <WorkspaceGate
        title="Screenshot"
        frame="pane"
        expectedWorkspace={workspace ?? ''}
        changed={unavailable}
      >
        {(selected) => (
          <ScreenshotReader
            workspace={selected}
            run={run}
            step={Number(step)}
            initial={Number(index)}
          />
        )}
      </WorkspaceGate>
    </Sheet>
  );
}

function ScreenshotReader({
  workspace,
  run,
  step,
  initial,
}: {
  workspace: Workspace;
  run: string | undefined;
  step: number;
  initial: number;
}) {
  const ready = useReadyWalkthrough(workspace);
  const [shown, setShown] = useState(Number.isInteger(initial) ? initial : 0);
  const items =
    ready?.run.id === run
      ? (ready?.content.stops[step - 1]?.evidence ?? [])
      : [];
  const item = items[shown];
  if (!ready || !item) return unavailable;
  return (
    <Box className="flex-1" paddingX={4} paddingBottom={8} gap={3}>
      <RichText text={item.shows} variant="secondary" />
      <Box className="flex-1 overflow-hidden rounded-lg border border-border">
        <EvidenceImage
          key={item.assetId}
          workspace={workspace}
          runId={ready.run.id}
          item={item}
          label={`Screenshot ${shown + 1}`}
        />
      </Box>
      {items.length > 1 ? (
        <Box className="flex-row items-center justify-center" gap={3}>
          <IconButton
            icon="previous"
            accessibilityLabel="Previous screenshot"
            disabled={shown === 0}
            onPress={() => setShown(shown - 1)}
          />
          <Text variant="secondary" tone="muted">
            {shown + 1} of {items.length}
          </Text>
          <IconButton
            icon="chevron"
            accessibilityLabel="Next screenshot"
            disabled={shown === items.length - 1}
            onPress={() => setShown(shown + 1)}
          />
        </Box>
      ) : null}
    </Box>
  );
}
