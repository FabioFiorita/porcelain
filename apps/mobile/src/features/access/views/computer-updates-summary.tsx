import { ActivityIndicator } from 'react-native';
import { Card } from '../../../components/ui/card';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { Separator } from '../../../components/ui/separator';
import {
  useServiceUpdates,
  useUpdatesIndicator,
} from '../queries/service-updates';
import { UpdateAllButton } from './update-all-button';

export function ComputerUpdatesSummary() {
  const { running } = useUpdatesIndicator();
  const { checking, refresh } = useServiceUpdates();
  return (
    <Card>
      <Item
        title="Check for updates"
        leading={<Icon name="refresh" tone="muted" />}
        trailing={
          checking ? (
            <ActivityIndicator colorClassName="accent-muted-foreground" />
          ) : undefined
        }
        disabled={running || checking}
        onPress={refresh}
      />
      <Separator inset="leading" />
      <UpdateAllButton />
    </Card>
  );
}
