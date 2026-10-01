import { summaryContentSecurityPolicy } from './content-security-policy.ts';

const remoteSummaryPath = /^\/remote-review-summaries\/([0-9A-Fa-f-]+)$/;

export function remoteSummaryRequest(pathname: string): boolean {
  return pathname.startsWith('/remote-review-summaries/');
}

export function remoteSummaryTarget(url: string): string | undefined {
  const source = new URL(url);
  const token = remoteSummaryPath.exec(source.pathname)?.[1];
  const computer = URL.parse(source.searchParams.get('computer') ?? '');
  const expires = source.searchParams.get('expires');
  const signature = source.searchParams.get('signature');
  if (
    token === undefined ||
    computer === null ||
    (computer.protocol !== 'http:' && computer.protocol !== 'https:') ||
    computer.username !== '' ||
    computer.password !== '' ||
    computer.pathname !== '/' ||
    computer.search !== '' ||
    computer.hash !== '' ||
    expires === null ||
    signature === null
  )
    return undefined;
  const target = new URL(`/review-summaries/${token}`, computer);
  target.search = new URLSearchParams({ expires, signature }).toString();
  return target.href;
}

export function remoteSummaryHeaders(upstream: Headers): Headers {
  const type = upstream.get('content-type') ?? '';
  return new Headers({
    'content-type': type.startsWith('text/html')
      ? type
      : 'text/plain; charset=utf-8',
    'content-security-policy': summaryContentSecurityPolicy(),
    'cache-control': 'private, no-store',
    'referrer-policy': 'no-referrer',
  });
}
