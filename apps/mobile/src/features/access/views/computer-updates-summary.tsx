import { useState } from 'react';
import {
  requestedRead,
  type RequestedRead,
} from '../../../shared/rules/requested-read';
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
  const [request, setRequest] = useState<RequestedRead>('idle');
  const next = requestedRead(request, { waiting: checking, failed });
  if (next !== request) setRequest(next);
  const check = () => {
    setRequest('requested');
    refresh();
  };
  return (
    <>
      <Card>
        <Item
          title="Check for updates"
          leading={<Icon name="refresh" tone="muted" />}
          trailing={next === 'reading' ? <Spinner inline /> : undefined}
          disabled={running || checking}
          onPress={check}
        />
        <Separator />
        <UpdateAllButton />
      </Card>
      {next === 'failed' ? (
        <ErrorState
          message="Couldn't check for updates."
          retry={{ label: 'Check again', onPress: check }}
        />
      ) : null}
    </>
  );
}
