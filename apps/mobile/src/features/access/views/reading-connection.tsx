import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Remote } from '@porcelain/client/access/rules';
import { Button } from '../../../components/ui/button';
import { Icon } from '../../../components/ui/icon';
import { Spinner } from '../../../components/ui/spinner';
import { Text } from '../../../components/ui/text';
import { useReadingConnectionNotice } from '../queries/environments';

export function ReadingConnection({ remote }: { remote: Remote }) {
  const notice = useReadingConnectionNotice(remote);
  const router = useRouter();
  if (!notice) return null;
  return (
    <View
      testID="reading-connection"
      pointerEvents="box-none"
      className="absolute inset-x-0 top-2 z-40 items-center px-4"
    >
      <View
        className={`max-w-full flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-3xl border border-border bg-popover py-1.5 pl-3 shadow-sm ${notice.repair ? 'pr-1.5' : 'pr-3'}`}>
        <View className="shrink flex-row items-center gap-2 py-1">
          {notice.interrupted ? (
            <Spinner inline />
          ) : (
            <Icon name="warning" tone="muted" size="small" />
          )}
          <Text variant="secondary" weight="medium" className="shrink">
            {notice.title}
          </Text>
        </View>
        {notice.repair ? (
          <Button
            label="Pair again"
            size="sm"
            variant="filled"
            onPress={() => router.push('/pair-computer')}
          />
        ) : null}
      </View>
    </View>
  );
}
