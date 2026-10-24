import { Effect } from 'effect';
import { expect, it } from 'vitest';
import { reviewFixture } from '../../spec/fixtures/review.ts';
import { BuildReviewLinksService } from './build-review-links-service.ts';
const review = reviewFixture({
  layers: [
    {
      id: '20000000-0000-4000-8000-000000000002',
      title: 'Decision',
      summary: '',
      lanes: [],
      steps: [],
      fingerprint: 'f',
    },
  ],
});
it.each([
  ['local', ['http://127.0.0.1:5090'], 'http://127.0.0.1:5090'],
  ['LAN', ['http://192.168.1.2:5090'], 'http://192.168.1.2:5090'],
  [
    'Cloudflare',
    ['https://review.example', 'http://127.0.0.1:5090'],
    'https://review.example',
  ],
  [
    'Tailscale',
    ['https://machine.ts.net:8443', 'http://127.0.0.1:5090'],
    'https://machine.ts.net:8443',
  ],
  ['IPv6 loopback', ['http://[::1]:5090'], 'http://[::1]:5090'],
])(
  'retains the real %s origin and exact review selection',
  (_, origins, origin) => {
    const links = build(origins);
    expect(links).toMatchObject({ kind: 'available' });
    if (links.kind !== 'available') throw new Error('Expected reachable links');
    const host = new URL(origin).host;
    const protocol = new URL(origin).protocol.slice(0, -1);
    expect(links.web).toBe(`${origin}/reviews/${review.reviewId}`);
    expect(links.revision.web).toBe(`${origin}/reviews/${review.reviewId}/1`);
    expect(links.decisions).toEqual([
      {
        layerId: review.layers[0]?.id,
        web: `${origin}/reviews/${review.reviewId}/1/decisions/20000000-0000-4000-8000-000000000002`,
        app: `https://porcelain.fabiofiorita.com/open/reviews/${review.reviewId}?environment=environment&host=${encodeURIComponent(host)}&protocol=${protocol}&revision=1&decision=20000000-0000-4000-8000-000000000002`,
      },
    ]);
    expect(links.revision.app).toBe(
      `https://porcelain.fabiofiorita.com/open/reviews/${review.reviewId}?environment=environment&host=${encodeURIComponent(host)}&protocol=${protocol}&revision=1`,
    );
  },
);
it('returns no link when no route is reachable', () => {
  expect(build([])).toEqual({
    kind: 'unavailable',
    reason: 'no-reachable-route',
  });
});
function build(origins: readonly string[]) {
  return Effect.runSync(
    Effect.flatMap(BuildReviewLinksService, (service) =>
      service.execute({
        review,
        environmentId: 'environment',
        routes: { hubOrigin: 'https://porcelain.fabiofiorita.com', origins },
      }),
    ).pipe(Effect.provide(BuildReviewLinksService.layer)),
  );
}
