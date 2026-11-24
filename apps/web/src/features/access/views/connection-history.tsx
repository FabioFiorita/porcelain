import { useAtomRef } from '@effect/atom-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { HistoryEntry } from '../adapters/connection-history';
import { connectionHistory } from '../store';

export function ConnectionHistory({
  environmentId,
}: {
  environmentId: string;
}) {
  const entries = useAtomRef(connectionHistory).filter(
    (entry) =>
      entry.environmentId === undefined ||
      entry.environmentId === environmentId,
  );
  const documents: [HistoryEntry, ...HistoryEntry[]][] = [];
  for (const entry of entries.toReversed()) {
    const group = documents.at(-1);
    if (group && group[0].documentId === entry.documentId) group.push(entry);
    else documents.push([entry]);
  }
  const exportUrl = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(entries, null, 2))}`;

  return (
    <Collapsible>
      <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
        Connection history
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="text-xs text-muted-foreground">
          Recent connection events recorded on this app. Times are in UTC.
        </p>
        <Button
          variant="outline"
          size="sm"
          render={
            <a href={exportUrl} download="porcelain-connection-history.json" />
          }
        >
          Export history
        </Button>
        <div className="max-h-96 space-y-3 overflow-y-auto py-2">
          {documents.map((records) => (
            <section
              key={`${records[0].documentId}:${records[0].diagnostic.at}`}
              className="space-y-1"
            >
              <h4 className="text-xs font-medium">
                Document started at{' '}
                {new Date(records[0].document).toISOString()}
              </h4>
              <ul className="space-y-1 text-xs">
                {records.map(({ diagnostic }, index) => (
                  <li
                    key={records.length - index}
                    className="flex flex-wrap gap-x-2"
                  >
                    <time className="font-mono text-muted-foreground">
                      {new Date(diagnostic.at).toISOString().slice(11, 23)}
                    </time>
                    <span>
                      {diagnostic.event}
                      {'code' in diagnostic &&
                        diagnostic.code !== undefined &&
                        ` · ${diagnostic.code}`}
                      {'reason' in diagnostic &&
                        diagnostic.reason &&
                        ` · ${diagnostic.reason}`}
                      {'retryMs' in diagnostic &&
                        diagnostic.retryMs !== undefined &&
                        ` · within ${diagnostic.retryMs} ms`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
