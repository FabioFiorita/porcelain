import { useRouter } from 'expo-router';
import {
  canRecheckWalkthroughWriters,
  walkthroughWriterLabel,
  walkthroughWriterNotice,
} from '@porcelain/client/projects/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import type { Workspace } from '../../projects/index';
import type { WalkthroughWriter } from '../queries/writer';

export function WalkthroughWriterRow({
  workspace,
  writer,
  existingMessage,
  signedOut,
}: {
  workspace: Workspace;
  writer: WalkthroughWriter;
  existingMessage?: string | undefined;
  signedOut?: boolean | undefined;
}) {
  const router = useRouter();
  const recheck = canRecheckWalkthroughWriters(writer, signedOut);
  const reason = walkthroughWriterNotice(writer, existingMessage);
  const choice = writer.writer;
  const models = writer.settings?.models ?? [];
  return (
    <Box gap={1} className="items-start">
      {choice && models.length > 0 ? (
        <Button
          label={walkthroughWriterLabel(choice, models)}
          accessibilityLabel={`Writer: ${walkthroughWriterLabel(choice, models)}`}
          variant="plain"
          size="sm"
          align="start"
          className="-ml-3.5"
          onPress={() =>
            router.push({
              pathname: '/walkthrough-writer',
              params: { workspace: workspace.key },
            })
          }
        />
      ) : null}
      {reason ? (
        <Text
          variant="secondary"
          tone="muted"
          accessibilityRole={writer.failed ? 'alert' : undefined}
        >
          {reason}
        </Text>
      ) : null}
      {recheck ? (
        <Button
          label="Check writers again"
          size="sm"
          variant="tonal"
          pending={writer.checking}
          onPress={writer.refresh}
        />
      ) : null}
    </Box>
  );
}
