import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { AsyncResult } from 'effect/reactivity';
import type {
  WalkthroughEvidence,
  WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { ImageTile } from '../../../components/ui/image-tile';
import { ImageView } from '../../../components/ui/image-view';
import { Loading } from '../../../components/ui/loading';
import { RichText } from '../../../components/ui/rich-text';
import { Text } from '../../../components/ui/text';
import type { Workspace } from '../../projects/index';
import { useWalkthroughAsset } from '../queries/walkthrough';

export function EvidenceImage({
  workspace,
  runId,
  item,
  label,
}: {
  workspace: Workspace;
  runId: string;
  item: WalkthroughEvidence;
  label: string;
}) {
  const data = useWalkthroughAsset({
    workspace,
    runId,
    assetId: item.assetId,
  });
  if (AsyncResult.isFailure(data))
    return (
      <Box className="flex-1 items-center justify-center" padding={2}>
        <Text variant="caption" tone="muted" className="text-center">
          This screenshot could not be loaded.
        </Text>
      </Box>
    );
  if (!AsyncResult.isSuccess(data))
    return (
      <Box className="flex-1 justify-center">
        <Loading label="Loading…" />
      </Box>
    );
  return <ImageView data={data.value} label={label} />;
}

export function WalkthroughProof({
  workspace,
  run,
  step,
  items,
}: {
  workspace: Workspace;
  run: WalkthroughRun;
  step: number;
  items: readonly WalkthroughEvidence[];
}) {
  const router = useRouter();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-4"
      contentContainerClassName="gap-3 px-4"
    >
      {items.map((item, index) => (
        <ImageTile
          key={item.assetId}
          accessibilityLabel={`Enlarge screenshot ${index + 1}`}
          image={
            <EvidenceImage
              workspace={workspace}
              runId={run.id}
              item={item}
              label={`Screenshot ${index + 1}`}
            />
          }
          caption={
            <RichText
              text={item.shows}
              variant="caption"
              tone="muted"
              lines={3}
            />
          }
          onPress={() =>
            router.push({
              pathname: '/walkthrough-screenshot',
              params: {
                workspace: workspace.key,
                run: run.id,
                step: String(step),
                index: String(index),
              },
            })
          }
        />
      ))}
    </ScrollView>
  );
}
