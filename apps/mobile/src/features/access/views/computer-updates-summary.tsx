import { useState } from 'react';
import { Card } from '../../../components/ui/card';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { Separator } from '../../../components/ui/separator';
import { Spinner } from '../../../components/ui/spinner';
import {
  useServiceUpdates,
  useUpdatesIndicator,
} from '../queries/service-updates';
import { UpdateAllButton } from './update-all-button';

export function ComputerUpdatesSummary() {
  const { running } = useUpdatesIndicator();
  const { checking, failed, refresh } = useServiceUpdates();
  const [requested, setRequested] = useState(false);
  const check = () => {
    setRequested(true);
    refresh();
  };
  return (
    <>
      <Card>
        <Item
          title="Check for updates"
          leading={<Icon name="refresh" tone="muted" />}
          trailing={requested && checking ? <Spinner inline /> : undefined}
          disabled={running || checking}
          onPress={check}
        />
        <Separator />
        <UpdateAllButton />
      </Card>
      {requested && !checking && failed ? (
        <ErrorState
          message="Couldn't check for updates."
          retry={{ label: 'Check again', onPress: check }}
        />
      ) : null}
    </>
  );
}
