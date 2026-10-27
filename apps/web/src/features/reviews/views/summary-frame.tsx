import { BotIcon, CheckIcon, ShieldCheckIcon } from 'lucide-react';
import { relativeTime } from '@/shared/lib/relative-time';
import { cn } from '@/shared/lib/utils';
import { StateSkeleton } from '@/shared/views/state-notice';
import {
  decisionKey,
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
  url: string | undefined;
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
          className="flex min-w-0 flex-col gap-8 text-xs @5xl/review:pt-8"
        >
          <section className="flex flex-col">
            <h3 className="mb-2 leading-4 font-medium text-muted-foreground">
              The agent's page
            </h3>
            <p className="border-t pt-2 text-ui leading-4.75">
              The agent wrote this page for revision {revision.revision}, for
              what the walkthrough cannot hold: a diagram, a screenshot.
            </p>
            <p className="mt-2 text-ui leading-4.75 text-muted-foreground">
              It runs in a sandbox, apart from Porcelain: it cannot reach your
              session, your files or the code. It only receives your theme.
            </p>
          </section>
          <section aria-label="Links in this page" className="flex flex-col">
            <h3 className="mb-2 flex justify-between leading-4 font-medium text-muted-foreground">
              Links in this page
              <span className="tabular-nums">{links.length}</span>
            </h3>
            {links.length === 0 ? (
              <p className="py-2 text-muted-foreground">
                This page links to no decisions.
              </p>
            ) : (
              <ul className="flex flex-col divide-y border-y">
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
                        className="flex min-h-7.5 w-full items-start gap-2 rounded-md py-1.5 pr-1 text-left text-ui leading-4.5 hover:bg-accent disabled:text-muted-foreground disabled:hover:bg-transparent"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'grid size-4.5 shrink-0 place-items-center rounded-full border border-border-strong text-2xs leading-none font-medium text-muted-foreground tabular-nums',
                            reviewed &&
                              'border-brand bg-brand text-brand-foreground',
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
          <p className="text-ui leading-4.75 text-muted-foreground">
            A decision link, here or in the page, opens that decision in the
            Walkthrough.
          </p>
        </aside>
      }
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-h-7 min-w-0 flex-wrap items-center gap-2 text-ui leading-4.5">
          <span
            aria-hidden="true"
            className="grid size-5.5 shrink-0 place-items-center rounded-md border border-border-strong"
          >
            <BotIcon className="size-3.25" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="font-semibold">The agent</strong>
            <span className="text-muted-foreground">
              {' '}
              wrote this page · revision {revision.revision} ·{' '}
              {relativeTime(revision.publishedAt)}
            </span>
          </span>
          <span
            title="The agent's page runs in an opaque sandbox: it cannot reach Porcelain, your session, your files or the code. It receives only your theme."
            className="inline-flex h-6 shrink-0 items-center gap-1.25 rounded-full border border-border-strong pr-2.25 pl-1.75 text-xs leading-5.5 font-medium"
          >
            <ShieldCheckIcon className="size-3.25 text-muted-foreground" />{' '}
            Sandboxed
          </span>
        </div>
        {url === undefined ? (
          <div className="min-h-96 rounded-xl border bg-background">
            <StateSkeleton label="Loading the agent's page" />
          </div>
        ) : (
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
        )}
      </div>
    </MarginRow>
  );
}
