import { ExternalLink, RotateCw } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Empty } from '@/components/lab/bits';
import { Button } from '@/components/ui/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { groupInteractions, totals } from '@/lib/format';
import { labApi, type Trace, useLab } from '@/lib/lab';
import { TraceWorkspace } from './traces';

/** The real Porcelain web on the left; what it asked the server for on the right. */
export function WebPage() {
  const { web, traces, runtime } = useLab();
  const frame = useRef<HTMLIFrameElement>(null);
  const [since, setSince] = useState(() => Date.now() - 10 * 60_000);
  const webTraces = useMemo(
    () =>
      traces.filter((trace) => trace.origin === 'web' && trace.start >= since),
    [traces, since],
  );
  const interactions = useMemo(
    () => groupInteractions(webTraces).reverse(),
    [webTraces],
  );
  const [open, setOpen] = useState<string>();
  const [selected, setSelected] = useState<Trace>();
  const interaction =
    interactions.find((group) => group.id === open) ?? interactions[0];
  const sum = totals(webTraces);
  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel defaultSize="58%" minSize="30%">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
            <span className="min-w-0 flex-1 truncate">
              The real Porcelain web, served by its own Vite and connected to
              the traced server.
            </span>
            {web.status === 'ready' && (
              <>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() =>
                    frame.current?.contentWindow?.location.reload()
                  }
                >
                  <RotateCw /> Reload
                </Button>
                <a
                  href={web.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <ExternalLink className="size-3" /> Open in a tab
                </a>
              </>
            )}
          </div>
          {web.status === 'ready' && runtime.status === 'ready' ? (
            <iframe
              ref={frame}
              key={runtime.status === 'ready' ? runtime.since : 0}
              src={web.url}
              title="Porcelain web"
              className="min-h-0 flex-1 bg-background"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-md space-y-3 text-center text-sm text-muted-foreground">
                {web.status === 'failed' ? (
                  <pre className="text-left text-xs whitespace-pre-wrap">
                    {web.error}
                  </pre>
                ) : web.status === 'starting' ? (
                  <p>Starting the web app…</p>
                ) : runtime.status !== 'ready' ? (
                  <p>Waiting for the server ({runtime.status}).</p>
                ) : (
                  <p>The web app is not running.</p>
                )}
                {(web.status === 'stopped' || web.status === 'failed') && (
                  <Button
                    onClick={() =>
                      void labApi('/web', {
                        method: 'POST',
                        body: JSON.stringify({ action: 'start' }),
                      })
                    }
                  >
                    Start the web app
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize="42%" minSize="25%">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b px-3 py-2 text-xs">
            <span className="font-medium">What the web asked for</span>
            <span className="tabular-nums text-muted-foreground">
              {sum.requests} requests · {sum.processes} git · {sum.sql} sql
            </span>
            <span className="flex-1" />
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setSince(Date.now())}
            >
              Start fresh
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            {interactions.length === 0 ? (
              <div className="p-3">
                <Empty>
                  Click around in Porcelain. Every request it makes lands here.
                </Empty>
              </div>
            ) : (
              <TraceWorkspace
                compact
                interactions={interactions}
                interaction={interaction}
                selectedTrace={
                  selected && interaction?.traces.includes(selected)
                    ? selected
                    : undefined
                }
                onInteraction={(group) => {
                  setOpen(group.id);
                  setSelected(undefined);
                }}
                onTrace={setSelected}
              />
            )}
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
