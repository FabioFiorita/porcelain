import { issuePairingResponseSchema } from '@porcelain/contracts/access';
import {
  list,
  record,
  text,
  type HttpRequest,
  type HttpResponse,
  type Session,
} from './session.ts';

export async function read(
  session: Session,
  request: HttpRequest,
  status = 200,
) {
  return record((await session.read(request, status)).body);
}

export async function issuePairing(session: Session, label = 'Verification') {
  const issued = await read(session, {
    method: 'POST',
    path: '/pairings',
    target: 'owner',
    body: { labels: [label], addresses: [session.address] },
  });
  return text(record(list(issued.grants)[0]).code);
}

export async function pairingGrant(
  session: Session,
  label: string,
  trusted = false,
) {
  const [grant] = issuePairingResponseSchema.parse(
    await read(session, {
      method: 'POST',
      path: '/pairings',
      target: 'owner',
      body: {
        labels: [label],
        addresses: [session.address],
        ...(trusted ? { trusted } : {}),
      },
    }),
  ).grants;
  if (grant === undefined) throw new Error('The owner issued no pairing grant');
  return {
    code: grant.link.code,
    environmentId: grant.link.environmentId,
    address: session.address,
  };
}

export async function pairDevice(session: Session, label = 'Second device') {
  const code = await issuePairing(session, label);
  const paired = await read(session, {
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    body: { code, platform: 'Verification' },
  });
  return {
    credential: text(paired.credential),
    deviceId: text(record(paired.device).id),
  };
}

export const SAMPLE_SUMMARY_HTML = '<html><body><h1>Summary</h1></body></html>';

export function lineCount(value: string) {
  return value.split('\n').length - 1;
}

export function sampleReview(
  session: Session,
  expectedRevision: number,
  layerId: string,
  stepId: string,
  options: { path?: string; title?: string; kind?: 'changed' | 'context' } = {},
) {
  const line = lineCount(session.fixture.readme.changed);
  return {
    expectedRevision,
    summaryHtml: SAMPLE_SUMMARY_HTML,
    layers: [
      {
        id: layerId,
        title: options.title ?? 'Readme',
        summary: 'Adds a line',
        lanes: ['Docs'],
        steps: [
          {
            id: stepId,
            lane: 0,
            title: 'New line',
            text: 'A line is added',
            kind: options.kind ?? 'changed',
            pointer: {
              path: options.path ?? session.fixture.readme.path,
              startLine: line,
              endLine: line,
            },
          },
        ],
      },
    ],
  };
}

export const mcpHeaders = (cwd: string) => ({
  accept: 'application/json, text/event-stream',
  'x-porcelain-cwd': cwd,
});

export function toolCall(
  session: Session,
  id: number,
  name: string,
  input: Record<string, unknown>,
): HttpRequest {
  return {
    method: 'POST',
    path: '/mcp',
    target: 'owner',
    headers: mcpHeaders(session.repository),
    body: {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name, arguments: input },
    },
  };
}

export function toolResult(body: unknown) {
  return record(record(body).result);
}

export function toolText(body: unknown) {
  return text(record(list(toolResult(body).content)[0]).text);
}

export function toolValue(body: unknown): unknown {
  const value: unknown = JSON.parse(toolText(body));
  return value;
}

export function worktreePath(session: Session, suffix = '') {
  return `/api/worktrees/${session.worktreeId}${suffix}`;
}

export function gitPath(
  session: Session,
  suffix: string,
  ids: { worktreeId?: string } = {},
) {
  return `/api/worktrees/${ids.worktreeId ?? session.worktreeId}/git${suffix}`;
}

export function receiptPath(
  session: Session,
  requestId: string,
  worktreeId = session.worktreeId,
) {
  return `/api/worktrees/${worktreeId}/git/receipts/${requestId}`;
}

export async function sendAll(
  session: Session,
  requests: readonly HttpRequest[],
): Promise<HttpResponse[]> {
  const responses: HttpResponse[] = [];
  for (const request of requests) responses.push(await session.send(request));
  return responses;
}

export function owner(request: Omit<HttpRequest, 'target'>): HttpRequest {
  return { ...request, target: 'owner' };
}

export function answered(id: number) {
  return { jsonrpc: '2.0', id, result: { content: [{ type: 'text' }] } };
}

export async function pairBrowser(
  session: Session,
  headers: Record<string, string> = {},
) {
  const code = await issuePairing(session, 'Browser');
  const paired = await session.read({
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    headers: { ...headers, 'x-porcelain-browser': '1' },
    body: { code, platform: 'Browser' },
  });
  const cookie = /porcelain_device=[^;]+/.exec(
    paired.headers['set-cookie'] ?? '',
  )?.[0];
  if (!cookie) throw new Error('Browser pairing set no device cookie');
  return { cookie, deviceId: text(record(record(paired.body).device).id) };
}
