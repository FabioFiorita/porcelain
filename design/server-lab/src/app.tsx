import { cn } from 'cn';
import { FlaskConical, ShieldAlert } from 'lucide-react';
import { CodePane, useCodePane } from '@/components/lab/source';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { TooltipProvider } from '@/components/ui/tooltip';
import { type RuntimeState, useLab } from '@/lib/lab';
import { href, useRoute } from '@/lib/route';
import { AgentPage } from '@/pages/agent';
import { ConsolePage } from '@/pages/console';
import { MapPage } from '@/pages/map';
import { OverviewPage } from '@/pages/overview';
import { ScalePage } from '@/pages/scale';
import { TestsPage } from '@/pages/tests';
import { TracesPage } from '@/pages/traces';
import { WebPage } from '@/pages/web';

const pages = [
  { id: 'overview', title: 'Overview' },
  { id: 'map', title: 'Map' },
  { id: 'web', title: 'Web + trace' },
  { id: 'traces', title: 'Traces' },
  { id: 'console', title: 'Console' },
  { id: 'scale', title: 'Scale' },
  { id: 'agent', title: 'Agent' },
  { id: 'tests', title: 'Tests' },
] as const;

export function App() {
  const route = useRoute();
  const page = route[0] ?? 'overview';
  const { runtime, connected } = useLab();
  const code = useCodePane();
  const real = runtime.status !== 'stopped' && runtime.mode.kind === 'real';
  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col bg-background">
        {real && (
          <div className="flex items-center gap-2 bg-[var(--lab-danger)] px-4 py-1.5 text-xs font-medium text-white">
            <ShieldAlert className="size-4" />
            Real project, read-only. Git actions, file edits and AI drafts are
            blocked. Don't screenshot or paste what you see here into PRs, docs
            or chats.
          </div>
        )}
        <header className="flex items-center gap-4 border-b px-4 py-2">
          <a
            href={href('overview')}
            className="flex items-center gap-2 font-semibold"
          >
            <FlaskConical className="size-4" /> Server Lab
          </a>
          <nav className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
            {pages.map((item) => (
              <a
                key={item.id}
                href={href(item.id)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground',
                  page === item.id && 'bg-muted text-foreground',
                )}
              >
                {item.title}
              </a>
            ))}
          </nav>
          <RuntimeChip runtime={runtime} connected={connected} />
        </header>
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          <ResizablePanel id="page" minSize={480}>
            <main className="relative h-full overflow-hidden">
              {page === 'overview' && <OverviewPage />}
              {page === 'map' && <MapPage area={route[1]} flow={route[2]} />}
              {page === 'web' && <WebPage />}
              {page === 'traces' && <TracesPage selected={route[1]} />}
              {page === 'console' && <ConsolePage initial={route[1]} />}
              {page === 'scale' && <ScalePage />}
              {page === 'agent' && <AgentPage />}
              {page === 'tests' && (
                <TestsPage area={route[1]} spec={route.slice(2).join('/')} />
              )}
            </main>
          </ResizablePanel>
          {code.tabs.length > 0 && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel id="code" defaultSize="48%" minSize={360}>
                <CodePane />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}

export function describeMode(runtime: RuntimeState) {
  if (runtime.status === 'stopped') return 'Stopped';
  return runtime.mode.kind === 'playground'
    ? `Playground · ${runtime.mode.profile}`
    : `Real · ${runtime.mode.repositories.length} repo${runtime.mode.repositories.length === 1 ? '' : 's'}`;
}

function RuntimeChip({
  runtime,
  connected,
}: {
  runtime: RuntimeState;
  connected: boolean;
}) {
  const color = !connected
    ? 'var(--lab-danger)'
    : runtime.status === 'ready'
      ? 'var(--lab-ok)'
      : runtime.status === 'failed'
        ? 'var(--lab-danger)'
        : 'var(--lab-warn)';
  return (
    <a
      href={href('scale')}
      className="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs hover:bg-muted"
      title="Change what the server runs against"
    >
      <span className="size-2 rounded-full" style={{ background: color }} />
      <span className="font-medium">{describeMode(runtime)}</span>
      <span className="text-muted-foreground">
        {!connected ? 'lab disconnected' : runtime.status}
      </span>
    </a>
  );
}
