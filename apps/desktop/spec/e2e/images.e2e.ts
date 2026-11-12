import { expect, test } from './fixtures.ts';

type ImageElement = {
  alt: string;
  referrerPolicy: string;
  src: string;
  onload: () => void;
  onerror: () => void;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
};

declare const document: {
  createElement: (tag: 'img') => ImageElement;
  body: { append: (image: ImageElement) => void };
};

for (const source of [
  'https://private-user-images.githubusercontent.com/1/2-evidence.png?jwt=fixture',
  'https://images.example.test/evidence.png',
]) {
  test(`the app displays a PR image from ${new URL(source).hostname}`, async ({
    desktop,
  }) => {
    const app = await desktop.launch();
    const page = await app.window();
    await page.route(source, (route) =>
      route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',
          'base64',
        ),
      }),
    );
    const image = await page.evaluate(async (source) => {
      const image = document.createElement('img');
      image.alt = 'PR screenshot';
      image.referrerPolicy = 'no-referrer';
      const loaded = new Promise<boolean>((resolve) => {
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
      });
      image.src = source;
      document.body.append(image);
      return {
        loaded: await loaded,
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
    }, source);
    expect(image).toEqual({ loaded: true, width: 1, height: 1 });
  });
}
