import type { TailnetReport, TailnetServing } from '@porcelain/access/models';
import type { TailnetStatusReader } from '@porcelain/access/ports';
import { z } from 'zod';
import { runTailscale, type TailscaleLimits } from './tailscale-command.ts';

const RUNNING = 'Running';
const HTTPS_CAPABILITY = 'https';

const statusSchema = z.object({
  BackendState: z.string(),
  CertDomains: z.array(z.string()).nullish(),
  Self: z
    .object({
      DNSName: z.string().nullish(),
      Capabilities: z.array(z.string()).nullish(),
      CapMap: z.record(z.string(), z.unknown()).nullish(),
    })
    .nullish(),
});

const serveConfigSchema = z.object({
  TCP: z
    .record(z.string(), z.object({ TCPForward: z.string().nullish() }))
    .nullish(),
  Web: z
    .record(
      z.string(),
      z.object({
        Handlers: z
          .record(z.string(), z.object({ Proxy: z.string().nullish() }))
          .nullish(),
      }),
    )
    .nullish(),
});

const serveStatusSchema = serveConfigSchema.extend({
  Foreground: z.record(z.string(), serveConfigSchema).nullish(),
});

type ServeConfig = z.output<typeof serveConfigSchema>;

function servedOn(config: ServeConfig, port: string): TailnetServing[] {
  const web = Object.entries(config.Web ?? {})
    .filter(([hostPort]) => hostPort.endsWith(`:${port}`))
    .map(([, site]): TailnetServing => {
      const handlers = Object.entries(site.Handlers ?? {});
      const [path, handler] = handlers[0] ?? [];
      return handlers.length === 1 && path === '/' && handler?.Proxy
        ? { kind: 'proxy', target: handler.Proxy }
        : { kind: 'other' };
    });
  return config.TCP?.[port]?.TCPForward ? [...web, { kind: 'other' }] : web;
}

function serving(
  status: z.output<typeof serveStatusSchema>,
  port: string,
): TailnetServing {
  const found = [status, ...Object.values(status.Foreground ?? {})].flatMap(
    (config) => servedOn(config, port),
  );
  const [first] = found;
  if (first === undefined) return { kind: 'nothing' };
  return found.length === 1 ? first : { kind: 'other' };
}

function parsed<Schema extends z.ZodType>(
  schema: Schema,
  stdout: string,
): z.output<Schema> | undefined {
  try {
    const result = schema.safeParse(JSON.parse(stdout));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export class ProcessTailnetStatusReader implements TailnetStatusReader {
  private readonly limits: TailscaleLimits;

  constructor(limits: TailscaleLimits) {
    this.limits = limits;
  }

  async read(): Promise<TailnetReport> {
    const status = await runTailscale(
      ['status', '--json', '--peers=false'],
      this.limits,
    );
    if (status.kind === 'missing') return { kind: 'missing' };
    if (status.kind === 'failed') return { kind: 'unavailable' };
    const served = await runTailscale(
      ['serve', 'status', '--json'],
      this.limits,
    );
    const node = parsed(statusSchema, status.stdout);
    const config =
      served.kind === 'done'
        ? parsed(serveStatusSchema, served.stdout)
        : undefined;
    if (node === undefined || config === undefined)
      return { kind: 'unavailable' };
    const capabilities = [
      ...(node.Self?.Capabilities ?? []),
      ...Object.keys(node.Self?.CapMap ?? {}),
    ];
    return {
      kind: 'status',
      running: node.BackendState === RUNNING,
      https:
        capabilities.includes(HTTPS_CAPABILITY) &&
        (node.CertDomains ?? []).length > 0,
      dnsName: node.Self?.DNSName ?? undefined,
      serving: serving(config, String(this.limits.httpsPort)),
    };
  }
}
