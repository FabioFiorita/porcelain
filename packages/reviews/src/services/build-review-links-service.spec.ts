import { Effect } from 'effect';
import { expect, it } from 'vitest';
import { reviewFixture } from '../../spec/fixtures/review.ts';
import { BuildReviewLinksService } from './build-review-links-service.ts';
const review = reviewFixture({
  layers: [
    {
      id: 'layer',
      title: 'Decision',
      summary: '',
      lanes: [],
      steps: [],
      fingerprint: 'f',
    },
  ],
});
it.each([
  [
    {
      cloudflare: 'review.example',
      tailnet: 'machine.ts.net',
      tailnetPort: 8443,
    },
    'review.example',
  ],
  [{ tailnet: 'machine.ts.net', tailnetPort: 8443 }, 'machine.ts.net:8443'],
  [{ tailnet: 'machine.ts.net', tailnetPort: 443 }, 'machine.ts.net'],
  [{}, '192.168.1.2:5090'],
])(
  'prefers the configured remote host and returns durable revision and decision destinations',
  (remote, host) => {
    const links = Effect.runSync(
      Effect.flatMap(BuildReviewLinksService, (service) =>
        service.execute({
          review,
          environmentId: 'environment',
          hosts: {
            hubOrigin: 'https://porcelain.fabiofiorita.com',
            localHost: '192.168.1.2',
            localPort: 5090,
            ...remote,
          },
        }),
      ).pipe(Effect.provide(BuildReviewLinksService.layer)),
    );
    expect(links.web).toBe(
      `https://${host}/reviews/10000000-0000-4000-8000-000000000001`,
    );
    expect(links.revision.web).toBe(
      `https://${host}/reviews/10000000-0000-4000-8000-000000000001/1`,
    );
    expect(links.decisions[0]?.web).toBe(
      `https://${host}/reviews/10000000-0000-4000-8000-000000000001/1/decisions/layer`,
    );
    expect(links.decisions[0]?.app).toBe(
      `https://porcelain.fabiofiorita.com/open/reviews/10000000-0000-4000-8000-000000000001?environment=environment&host=${encodeURIComponent(host)}&revision=1&decision=layer`,
    );
  },
);
