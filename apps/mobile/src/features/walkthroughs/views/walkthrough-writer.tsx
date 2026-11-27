import { useRouter } from 'expo-router';
import {
  canRecheckWalkthroughWriters,
  walkthroughWriterLabel,
  walkthroughWriterNotice,
} from '@porcelain/client/projects/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Icon } from '../../../components/ui/icon';
import { Text } from '../../../components/ui/text';
import type { Workspace } from '../../projects/index';
import type { WalkthroughWriter } from '../queries/writer';

export function walkthroughWriterUnavailable(writer: WalkthroughWriter) {
  return writer.noWriters || Boolean(writer.status?.block);
}

function RecheckNotice({
  writer,
  reason,
  primary,
}: {
  writer: WalkthroughWriter;
  reason: string | undefined;
  primary: boolean;
}) {
  return (
    <Card
      variant="notice"
      padding={4}
      gap={2}
      className="self-stretch"
      accessibilityRole={writer.failed ? 'alert' : undefined}
    >
      <Box className="flex-row" gap={2}>
        <Icon name="info" tone="muted" size="small" />
        <Text variant="secondary" className="min-w-0 flex-1">
          {reason ?? 'Sign in on the connected computer, then check again.'}
        </Text>
      </Box>
      <Button
        label="Check again"
        size="sm"
        variant={primary ? 'filled' : 'tonal'}
        className="self-start"
        pending={writer.checking}
        onPress={writer.refresh}
      />
    </Card>
  );
}

export function WalkthroughWriterRow({
  workspace,
  writer,
  existingMessage,
  signedOut,
  primary = false,
}: {
  workspace: Workspace;
  writer: WalkthroughWriter;
  existingMessage?: string | undefined;
  signedOut?: boolean | undefined;
  primary?: boolean;
}) {
  const router = useRouter();
  const recheck = canRecheckWalkthroughWriters(writer, signedOut);
  const reason = walkthroughWriterNotice(writer, existingMessage);
  const settings =
    !writer.noWriters && !writer.failed && Boolean(writer.status?.block);
  if (recheck && !settings)
    return <RecheckNotice writer={writer} reason={reason} primary={primary} />;
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
          label="Check again"
          size="sm"
          variant="tonal"
          pending={writer.checking}
          onPress={writer.refresh}
        />
      ) : null}
    </Box>
  );
}
