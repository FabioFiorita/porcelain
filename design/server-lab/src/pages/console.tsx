import { useQuery } from '@tanstack/react-query';
import { cn } from 'cn';
import { Bot, Send } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { Empty, Method, Section } from '@/components/lab/bits';
import { example, JsonView } from '@/components/lab/json';
import { SourceLink } from '@/components/lab/source';
import { TraceDetail } from '@/components/lab/traces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { bytes, ms } from '@/lib/format';
import {
  type PorcelainResponse,
  porcelain,
  type RouteInfo,
  useLab,
} from '@/lib/lab';
import { areas } from '@/lib/map';
import { href } from '@/lib/route';

type Inventory = {
  projects: {
    id: string;
    name: string;
    worktrees: {
      id: string;
      path: string;
      branch: string | null;
      main: boolean;
    }[];
  }[];
};

const key = (route: { method: string; url: string }) =>
  `${route.method} ${route.url}`;

export function ConsolePage({ initial }: { initial?: string }) {
  const { runtime } = useLab();
  const routes = runtime.status === 'ready' ? runtime.routes : [];
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'http' | 'mcp'>('http');
  const selected =
    routes.find((route) => key(route) === initial) ??
    routes.find((route) => route.url === '/api/inventory');
  const groups = useMemo(() => {
    const known = new Set<string>();
    const result = areas.map((area) => {
      const items = area.flows.flatMap((flow) => {
        if (!flow.endpoint) return [];
        const route = routes.find(
          (candidate) =>
            candidate.method === flow.endpoint?.method &&
            candidate.url === flow.endpoint.path,
        );
        if (!route) return [];
        known.add(key(route));
        return [{ route, title: flow.title }];
      });
      return { title: area.title, items };
    });
    const other = routes
      .filter((route) => !known.has(key(route)))
      .map((route) => ({ route, title: route.url }));
    if (other.length)
      result.push({
        title: areas.length ? 'Not in the map' : 'Routes',
        items: other,
      });
    return result
      .map((group) => ({
        ...group,
        items: group.items.filter(({ route, title }) =>
          `${route.method} ${route.url} ${title}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        ),
      }))
      .filter((group) => group.items.length);
  }, [routes, search]);

  if (runtime.status !== 'ready')
    return (
      <div className="p-6">
        <Empty>
          The server is {runtime.status}. The console needs it running.
        </Empty>
      </div>
    );
  return (
    <div className="grid h-full grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-r">
        <div className="flex gap-1 border-b p-2">
          <Button
            size="sm"
            variant={mode === 'http' ? 'secondary' : 'ghost'}
            onClick={() => setMode('http')}
          >
            HTTP ({routes.length})
          </Button>
          <Button
            size="sm"
            variant={mode === 'mcp' ? 'secondary' : 'ghost'}
            onClick={() => setMode('mcp')}
          >
            <Bot /> MCP tools
          </Button>
        </div>
        {mode === 'http' && (
          <>
            <div className="p-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search routes…"
                className="h-8"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-2 pb-4">
              {groups.map((group) => (
                <div key={group.title} className="mb-3">
                  <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    {group.title}
                  </div>
                  {group.items.map(({ route, title }) => (
                    <a
                      key={key(route)}
                      href={href('console', key(route))}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted',
                        selected && key(selected) === key(route) && 'bg-muted',
                      )}
                      title={route.url}
                    >
                      <Method
                        method={route.method}
                        className="w-11 text-[10px]"
                      />
                      <span className="min-w-0 truncate">{title}</span>
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
      <div className="min-h-0 overflow-auto">
        {mode === 'mcp' ? (
          <McpConsole />
        ) : selected ? (
          <RouteConsole key={key(selected)} route={selected} />
        ) : null}
      </div>
    </div>
  );
}

function useInventory() {
  return useQuery({
    queryKey: ['console-inventory'],
    queryFn: async () =>
      (await porcelain('GET', '/api/inventory', { origin: 'setup' }))
        .data as Inventory,
    staleTime: 10_000,
  });
}

function RouteConsole({ route }: { route: RouteInfo }) {
  const { traces, runtime } = useLab();
  const inventory = useInventory();
  const params = route.url
    .split('/')
    .filter((part) => part.startsWith(':'))
    .map((part) => part.slice(1));
  const query = Object.keys(
    (route.querystring as { properties?: object } | undefined)?.properties ??
      {},
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [body, setBody] = useState(() =>
    route.body ? JSON.stringify(example(route.body), null, 2) : '',
  );
  const [result, setResult] = useState<PorcelainResponse & { run: string }>();
  const [sending, setSending] = useState(false);
  useEffect(() => {
    // Sensible defaults: the review worktree and its project.
    const all = inventory.data?.projects.flatMap((project) =>
      project.worktrees.map((worktree) => ({ ...worktree, project })),
    );
    const review = all?.find((worktree) => !worktree.main) ?? all?.[0];
    if (!review) return;
    setValues((current) =>
      current.worktreeId && current.projectId
        ? current
        : { ...current, worktreeId: review.id, projectId: review.project.id },
    );
  }, [inventory.data]);
  const path =
    route.url.replace(/:(\w+)/g, (_, name: string) =>
      encodeURIComponent(values[name] ?? `:${name}`),
    ) +
    (query.some((name) => values[`?${name}`])
      ? `?${new URLSearchParams(
          Object.fromEntries(
            query
              .filter((name) => values[`?${name}`])
              .map((name) => [name, values[`?${name}`] as string]),
          ),
        )}`
      : '');
  const send = async () => {
    setSending(true);
    const run = `console-${crypto.randomUUID()}`;
    try {
      let payload: unknown;
      if (route.body && body.trim()) payload = JSON.parse(body);
      const response = await porcelain(route.method, path, {
        body: payload,
        run,
      });
      setResult({ ...response, run });
    } catch (error) {
      setResult({
        status: 0,
        ms: 0,
        bytes: 0,
        data: String(error),
        text: String(error),
        run: '',
      });
    } finally {
      setSending(false);
    }
  };
  const trace = result?.run
    ? traces.find((candidate) => candidate.run === result.run)
    : undefined;
  const flow = areas
    .flatMap((area) => area.flows.map((item) => ({ area, flow: item })))
    .find(
      ({ flow }) =>
        flow.endpoint?.method === route.method &&
        flow.endpoint.path === route.url,
    );
  return (
    <div className="space-y-6 p-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Method method={route.method} className="w-auto text-sm" />
          <span className="font-mono text-sm">{route.url}</span>
        </div>
        {flow && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <a
              href={href('map', flow.area.id, flow.flow.id)}
              className="hover:underline"
            >
              {flow.area.title} → {flow.flow.title}
            </a>
            <span>queue: {flow.flow.runner}</span>
            {flow.flow.endpoint && (
              <SourceLink source={flow.flow.endpoint.source}>
                route source
              </SourceLink>
            )}
          </div>
        )}
        {runtime.status === 'ready' && runtime.readOnly && (
          <p className="text-xs text-[var(--lab-danger)]">
            Real project: repository-changing routes are refused by the lab.
          </p>
        )}
      </div>
      {(params.length > 0 || query.length > 0) && (
        <Section title="Parameters">
          <div className="grid max-w-3xl grid-cols-[140px_minmax(0,1fr)] items-center gap-2 text-sm">
            {params.map((name) => (
              <ParamInput
                key={name}
                name={name}
                value={values[name] ?? ''}
                onChange={(value) =>
                  setValues((current) => ({ ...current, [name]: value }))
                }
                inventory={inventory.data}
              />
            ))}
            {query.map((name) => (
              <ParamInput
                key={`?${name}`}
                name={`?${name}`}
                value={values[`?${name}`] ?? ''}
                onChange={(value) =>
                  setValues((current) => ({ ...current, [`?${name}`]: value }))
                }
              />
            ))}
          </div>
        </Section>
      )}
      {route.body !== undefined && (
        <Section
          title="Body"
          description="Pre-filled from the route's Zod contract."
        >
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-40 max-w-3xl font-mono text-xs"
            spellCheck={false}
          />
        </Section>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={() => void send()} disabled={sending}>
          <Send /> {sending ? 'Sending…' : 'Send'}
        </Button>
        <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
          {path}
        </span>
      </div>
      {result && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Section
            title={
              <span className="tabular-nums">
                Response {result.status} · {ms(result.ms)} ·{' '}
                {bytes(result.bytes)}
              </span>
            }
          >
            <div className="max-h-[60vh] overflow-auto rounded-lg border p-3">
              <JsonView value={result.data} />
            </div>
          </Section>
          <Section title="What the server did">
            {trace ? (
              <TraceDetail trace={trace} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Waiting for the trace…
              </p>
            )}
          </Section>
        </div>
      )}
      <details className="max-w-3xl text-xs">
        <summary className="cursor-pointer text-muted-foreground">
          Contract (JSON Schema from Zod)
        </summary>
        <div className="mt-2 space-y-3 rounded-lg border p-3">
          {(['params', 'querystring', 'body', 'response'] as const).map(
            (part) =>
              route[part] ? (
                <div key={part}>
                  <div className="mb-1 font-medium">{part}</div>
                  <JsonView value={route[part]} />
                </div>
              ) : null,
          )}
        </div>
      </details>
    </div>
  );
}

function ParamInput({
  name,
  value,
  onChange,
  inventory,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  inventory?: Inventory;
}) {
  const options =
    name === 'worktreeId'
      ? inventory?.projects.flatMap((project) =>
          project.worktrees.map((worktree) => ({
            value: worktree.id,
            label: `${project.name} · ${worktree.branch ?? 'detached'}${worktree.main ? ' (main)' : ''}`,
          })),
        )
      : name === 'projectId'
        ? inventory?.projects.map((project) => ({
            value: project.id,
            label: project.name,
          }))
        : undefined;
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="font-mono text-xs text-muted-foreground">
        {name}
      </label>
      {options ? (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 font-mono text-xs"
        />
      )}
    </>
  );
}

type Tool = { name: string; description?: string; inputSchema?: unknown };

async function mcp(method: string, params?: unknown, run?: string) {
  const response = await porcelain('POST', '/api/mcp', {
    origin: 'mcp',
    run,
    headers: { accept: 'application/json, text/event-stream' },
    body: {
      jsonrpc: '2.0',
      id: 1,
      method,
      ...(params === undefined ? {} : { params }),
    },
  });
  return response;
}

function McpConsole() {
  const { traces } = useLab();
  const inventory = useInventory();
  const tools = useQuery({
    queryKey: ['mcp-tools'],
    queryFn: async () => {
      const response = await mcp('tools/list');
      const data = response.data as {
        result?: { tools: Tool[] };
        error?: { message: string };
      };
      if (!data.result) throw new Error(data.error?.message ?? response.text);
      return data.result.tools;
    },
  });
  const [selected, setSelected] = useState<string>();
  const tool =
    tools.data?.find((candidate) => candidate.name === selected) ??
    tools.data?.[0];
  const [args, setArgs] = useState('');
  const [result, setResult] = useState<PorcelainResponse & { run: string }>();
  useEffect(() => {
    if (!tool) return;
    const review =
      inventory.data?.projects
        .flatMap((project) => project.worktrees)
        .find((worktree) => !worktree.main) ??
      inventory.data?.projects[0]?.worktrees[0];
    setArgs(
      JSON.stringify(
        example(tool.inputSchema, review ? { worktreeId: review.id } : {}),
        null,
        2,
      ),
    );
  }, [tool, inventory.data]);
  const trace = result
    ? traces.find((candidate) => candidate.run === result.run)
    : undefined;
  return (
    <div className="grid gap-6 p-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="space-y-1">
        <p className="mb-2 text-xs text-muted-foreground">
          What an agent sees: the same tools Claude Code or Codex call over MCP.
          Calls are attributed to the agent.
        </p>
        {tools.isError && (
          <p className="text-xs text-[var(--lab-danger)]">
            {String(tools.error)}
          </p>
        )}
        {tools.data?.map((candidate) => (
          <button
            key={candidate.name}
            type="button"
            onClick={() => setSelected(candidate.name)}
            className={cn(
              'block w-full rounded-md px-2 py-1 text-left font-mono text-xs hover:bg-muted',
              tool?.name === candidate.name && 'bg-muted',
            )}
          >
            {candidate.name}
          </button>
        ))}
      </div>
      {tool && (
        <div className="space-y-4">
          <div>
            <div className="font-mono text-sm">{tool.name}</div>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </div>
          <Textarea
            value={args}
            onChange={(event) => setArgs(event.target.value)}
            className="min-h-40 font-mono text-xs"
            spellCheck={false}
          />
          <Button
            onClick={async () => {
              const run = `mcp-${crypto.randomUUID()}`;
              try {
                const response = await mcp(
                  'tools/call',
                  { name: tool.name, arguments: JSON.parse(args || '{}') },
                  run,
                );
                setResult({ ...response, run });
              } catch (error) {
                setResult({
                  status: 0,
                  ms: 0,
                  bytes: 0,
                  data: String(error),
                  text: String(error),
                  run,
                });
              }
            }}
          >
            <Send /> Call tool
          </Button>
          {result && (
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="max-h-[60vh] overflow-auto rounded-lg border p-3">
                <JsonView value={result.data} />
              </div>
              <div>{trace ? <TraceDetail trace={trace} /> : null}</div>
            </div>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Input schema
            </summary>
            <div className="mt-2 rounded-lg border p-3">
              <JsonView value={tool.inputSchema} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
