import { createServer } from 'node:http';
import { expect, test } from './fixtures.ts';

test('native HTML disables scripts and outside loads while safe links return to the caller', async ({
  app,
}) => {
  const requests: string[] = [];
  const outside = createServer((request, response) => {
    requests.push(request.url ?? '');
    response.end('outside');
  });
  await new Promise<void>((resolve, reject) => {
    outside.once('error', reject);
    outside.listen(61991, '127.0.0.1', resolve);
  });
  try {
    expect(
      await app.run('html-isolation.yaml', {
        PREVIEW_URL: `${app.link('/component-preview')}&name=HtmlPreview`,
      }),
    ).toEqual({ name: 'Inspect isolated native HTML', status: 'passed' });
    expect(requests).toEqual([]);
  } finally {
    await new Promise<void>((resolve, reject) =>
      outside.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
