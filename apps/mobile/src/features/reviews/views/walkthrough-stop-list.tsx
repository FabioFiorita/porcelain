import { Fragment } from 'react';
import {
  notExplainedLabel,
  stopName,
  type ReviewResponse,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { Card } from '../../../components/ui/card';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { Separator } from '../../../components/ui/separator';
import { StatusTile } from '../../../components/ui/status-tile';

export function WalkthroughStopList({
  review,
  stops,
  done,
  onStop,
}: {
  review: ReviewResponse;
  stops: readonly WalkthroughStop[];
  done: (stop: WalkthroughStop) => boolean;
  onStop: (stop: Exclude<WalkthroughKey, 'briefing'>) => void;
}) {
  const entries = stops.filter((stop) => stop.kind !== 'briefing');
  if (entries.length === 0) return null;
  return (
    <Card>
      {entries.map((entry, index) => {
        const reviewed = done(entry);
        return (
          <Fragment key={entry.key}>
            {index > 0 ? <Separator inset="leading" /> : null}
            <Item
              title={stopName(entry)}
              titleNumberOfLines={2}
              description={stopDescription(review, entry)}
              descriptionNumberOfLines={2}
              leading={<StopMark stop={entry} reviewed={reviewed} />}
              trailing={<Icon name="chevron" tone="muted" />}
              accessibilityLabel={`Open ${stopName(entry)}${entry.kind === 'decision' ? `, decision ${entry.number}` : ''}${reviewed ? ', reviewed' : ''}`}
              testID={`walkthrough-${entry.key}`}
              onPress={() => onStop(entry.key)}
            />
          </Fragment>
        );
      })}
    </Card>
  );
}

function StopMark({
  stop,
  reviewed,
}: {
  stop: Exclude<WalkthroughStop, { kind: 'briefing' }>;
  reviewed: boolean;
}) {
  if (reviewed) return <StatusTile name="check" tone="add" />;
  if (stop.kind === 'decision')
    return <StatusTile label={String(stop.number)} tone="muted" />;
  return <StatusTile name="file" tone="muted" />;
}

function stopDescription(
  review: ReviewResponse,
  stop: Exclude<WalkthroughStop, { kind: 'briefing' }>,
) {
  if (stop.kind === 'decision') return stop.layer.summary;
  if (stop.kind === 'specs') return `${stop.paths.length} spec files set apart`;
  return (
    notExplainedLabel(review.notExplained) ?? 'Changes no decision explains'
  );
}
