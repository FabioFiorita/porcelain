import { useIsFocused, useRouter } from 'expo-router';
import type { Remote } from '@porcelain/client/access/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { FloatingBar } from '../../../components/ui/floating-bar';
import { Icon } from '../../../components/ui/icon';
import { Spinner } from '../../../components/ui/spinner';
import { Text } from '../../../components/ui/text';
import { useReadingConnectionNotice } from '../queries/environments';
import { useEnvironments } from '../store';
import { usePairComputerAgain } from '../pairing-sheet';

export function ReadingConnection({ remote }: { remote: Remote }) {
  return useIsFocused() ? <FocusedReadingConnection remote={remote} /> : null;
}

function FocusedReadingConnection({ remote }: { remote: Remote }) {
  const notice = useReadingConnectionNotice(remote);
  const router = useRouter();
  const pairAgain = usePairComputerAgain();
  if (!notice) return null;
  return (
    <FloatingBar
      placement="top"
      testID="reading-connection"
      action={
        notice.repair ? (
          <Button
            label="Pair again"
            size="sm"
            onPress={() => {
              pairAgain(remote.environmentId);
              router.navigate('/pair-computer', { withAnchor: true });
            }}
          />
        ) : undefined
      }
    >
      <Box className="shrink flex-row items-center" gap={2}>
        {notice.interrupted ? (
          <Spinner inline />
        ) : (
          <Icon name="warning" tone="muted" size="small" />
        )}
        <Text variant="secondary" weight="medium" className="shrink">
          {notice.title}
        </Text>
      </Box>
    </FloatingBar>
  );
}

export function ComputerConnectionNotice({
  environmentId,
}: {
  environmentId: string | undefined;
}) {
  const remote = useEnvironments().find(
    (environment) => environment.environmentId === environmentId,
  );
  return remote ? <ReadingConnection remote={remote} /> : null;
}
