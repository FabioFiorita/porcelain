import { useAtomRef } from '@effect/atom-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  const documents = Map.groupBy(
    entries.toReversed(),
    (entry) => entry.document,
  );

  return (
    <Collapsible>
      <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
        Connection history
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="text-xs text-muted-foreground">
          Recent connection events recorded on this app. Times are in UTC.
        </p>
        <div className="max-h-96 space-y-3 overflow-y-auto py-2">
          {[...documents].map(([document, records]) => (
            <section key={document} className="space-y-1">
              <h4 className="text-xs font-medium">
                Document started at {new Date(document).toISOString()}
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
