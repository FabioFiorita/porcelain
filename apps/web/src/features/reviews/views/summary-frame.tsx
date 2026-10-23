import { BotIcon, CheckIcon, ShieldCheckIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import {
  decisionKey,
  publishedLabel,
  summaryLayerLinks,
  type ReviewRevision,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { bindSummaryLayerRequests } from '../adapters/summary-messages';
import { MarginRow } from './margin-row';

export function SummaryFrame({
  revision,
  page,
  url,
  dark,
  stops,
  done,
  onGo,
}: {
  revision: ReviewRevision;
  page: string | undefined;
  url: string;
  dark: boolean;
  stops: readonly WalkthroughStop[];
  done: (stop: WalkthroughStop) => boolean;
  onGo: (key: WalkthroughKey) => void;
}) {
  const layers = revision.content.layers;
  const links = summaryLayerLinks(page ?? '');
  const open = (number: number) => {
    const layer = layers[number - 1];
    if (layer) onGo(decisionKey(layer.id));
  };
  return (
    <MarginRow
      margin={
        <aside
          aria-label="About the agent summary"
          className="flex min-w-0 flex-col gap-6 text-xs @5xl/review:pt-10"
        >
          <section className="flex flex-col gap-2">
            <h3 className="border-b pb-2 font-medium text-muted-foreground">
              The agent's page
            </h3>
            <p>
              The agent wrote this page for revision {revision.revision}, for
              what the walkthrough cannot hold: a diagram, a screenshot.
            </p>
            <p className="text-muted-foreground">
              It runs in a sandbox, apart from Porcelain: it cannot reach your
              session, your files or the code. It only receives your theme.
            </p>
          </section>
          <section aria-label="Links in this page" className="flex flex-col">
            <h3 className="flex justify-between border-b pb-2 font-medium text-muted-foreground">
              Links in this page
              <span className="tabular-nums">{links.length}</span>
            </h3>
            {links.length === 0 ? (
              <p className="py-2 text-muted-foreground">
                This page links to no decisions.
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {links.map((number) => {
                  const layer = layers[number - 1];
                  const stop = stops.find(
                    (item) =>
                      item.kind === 'decision' && item.layer.id === layer?.id,
                  );
                  const reviewed = stop !== undefined && done(stop);
                  return (
                    <li key={number}>
                      <button
                        type="button"
                        disabled={!layer}
                        onClick={() => open(number)}
                        className="flex w-full items-start gap-2 py-2 text-left text-caption hover:bg-accent/50 disabled:text-muted-foreground disabled:hover:bg-transparent"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'grid size-5 shrink-0 place-items-center rounded-full border text-2xs tabular-nums',
                            reviewed &&
                              'border-graph-1 bg-graph-1 text-background',
                          )}
                        >
                          {reviewed ? <CheckIcon className="size-3" /> : number}
                        </span>
                        <span className="min-w-0 wrap-anywhere">
                          {layer
                            ? layer.title
                            : `Decision ${number} is not in this revision`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <p className="text-muted-foreground">
            A decision link, here or in the page, opens that decision in the
            Walkthrough.
          </p>
        </aside>
      }
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          <BotIcon className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <strong className="font-medium">The agent</strong>
            <span className="text-muted-foreground">
              {' '}
              wrote this page · revision {revision.revision} ·{' '}
              {publishedLabel(revision.publishedAt)}
            </span>
          </span>
          <Badge variant="outline">
            <ShieldCheckIcon /> Sandboxed
          </Badge>
        </div>
        <iframe
          ref={(frame) =>
            frame ? bindSummaryLayerRequests(frame, open) : undefined
          }
          title="Review summary"
          src={`${url}#theme=${dark ? 'dark' : 'light'}`}
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
          referrerPolicy="no-referrer"
          className="h-svh max-h-screen min-h-96 w-full rounded-xl border bg-background"
        />
      </div>
    </MarginRow>
  );
}
