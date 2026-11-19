import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type {
  WalkthroughEvidence,
  WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { ErrorState } from '../../../components/ui/error-state';
import { ImageTile } from '../../../components/ui/image-tile';
import { ImageView } from '../../../components/ui/image-view';
import { Spinner } from '../../../components/ui/spinner';
import { RichText } from '../../../components/ui/rich-text';
import type { Workspace } from '../../projects/index';
import { useWalkthroughAsset } from '../queries/walkthrough';

export function EvidenceImage({
  workspace,
  runId,
  item,
  label,
  tile = false,
}: {
  workspace: Workspace;
  runId: string;
  item: WalkthroughEvidence;
  label: string;
  tile?: boolean;
}) {
  const asset = useWalkthroughAsset({
    workspace,
    runId,
    assetId: item.assetId,
  });
  const image = Option.getOrUndefined(AsyncResult.value(asset.result));
  if (image) return <ImageView data={image} label={label} quiet={tile} />;
  if (tile) return <Box className="flex-1" />;
  if (AsyncResult.isFailure(asset.result))
    return (
      <Box className="flex-1 justify-center" padding={4}>
        <ErrorState
          message="This screenshot could not be loaded."
          retry={{
            label: 'Read screenshot again',
            onPress: asset.refresh,
            pending: asset.result.waiting,
          }}
        />
      </Box>
    );
  return <Spinner />;
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
              tile
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
