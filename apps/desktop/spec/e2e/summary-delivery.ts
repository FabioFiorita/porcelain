import {
  expect,
  type DesktopApp,
  type Page,
  type TestInfo,
} from './fixtures.ts';

export async function observeSummaryDelivery(
  app: DesktopApp,
  page: Page,
  testInfo: TestInfo,
) {
  await app.electron.evaluate(({ BrowserWindow, net, session }) => {
    const view = BrowserWindow.getAllWindows()[0];
    if (view === undefined) throw new Error('The app window is missing');
    view.webContents.on(
      'did-fail-load',
      (_event, code, description, url, mainFrame) => {
        process.stderr.write(
          `${JSON.stringify({ summaryLoad: { code, description, path: URL.parse(url)?.pathname.replace(/(\/(?:remote-)?review-summaries\/)[^/]+/, '$1[redacted]'), mainFrame } })}\n`,
        );
      },
    );
    view.webContents.on(
      'did-frame-finish-load',
      (_event, mainFrame, processId, routingId) => {
        process.stderr.write(
          `${JSON.stringify({ summaryFrameFinished: { mainFrame, processId, routingId } })}\n`,
        );
      },
    );
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['<all_urls>'] },
      (request, callback) => {
        const path = new URL(request.url).pathname.replace(
          /(\/(?:remote-)?review-summaries\/)[^/]+/,
          '$1[redacted]',
        );
        if (/^\/(?:remote-)?review-summaries\//.test(path))
          process.stderr.write(
            `${JSON.stringify({
              summaryIngress: {
                id: request.id,
                path,
                resource: request.resourceType,
                initiator:
                  request.initiatorOrigin === undefined
                    ? 'missing'
                    : request.initiatorOrigin === 'null'
                      ? 'opaque'
                      : request.initiatorOrigin === 'porcelain://app'
                        ? 'app'
                        : 'other',
              },
            })}\n`,
          );
        callback({});
      },
    );
    const fetch = net.fetch.bind(net);
    net.fetch = async (input, init) => {
      const path = URL.parse(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      )?.pathname.replace(
        /(\/(?:remote-)?review-summaries\/)[^/]+/,
        '$1[redacted]',
      );
      const summary =
        path !== undefined && /^\/(?:remote-)?review-summaries\//.test(path);
      if (summary) {
        process.stderr.write(`${JSON.stringify({ summaryFetch: { path } })}\n`);
        init?.signal?.addEventListener(
          'abort',
          () => {
            process.stderr.write(
              `${JSON.stringify({ summaryAborted: { path } })}\n`,
            );
          },
          { once: true },
        );
      }
      const response = await fetch(input, init);
      if (summary)
        process.stderr.write(
          `${JSON.stringify({ summaryResponse: { path, status: response.status } })}\n`,
        );
      return response;
    };
  });
  let iframeRequest:
    | { path: string; theme: string; computer: string | undefined }
    | undefined;
  page.on('request', (request) => {
    const url = new URL(request.url());
    const path = url.pathname.replace(
      /(\/(?:remote-)?review-summaries\/)[^/]+/,
      '$1[redacted]',
    );
    if (
      /^\/(?:remote-)?review-summaries\//.test(path) &&
      request.isNavigationRequest()
    )
      iframeRequest = {
        path,
        theme: url.hash,
        computer: URL.parse(url.searchParams.get('computer') ?? '')?.origin,
      };
    if (/^\/(?:remote-)?review-summaries\//.test(path))
      app.output.push(
        `${JSON.stringify({ summaryBrowserRequest: { path, navigation: request.isNavigationRequest() } })}\n`,
      );
  });
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname.replace(
      /(\/(?:remote-)?review-summaries\/)[^/]+/,
      '$1[redacted]',
    );
    if (/^\/(?:remote-)?review-summaries\//.test(path))
      app.output.push(
        `${JSON.stringify({ summaryBrowserResponse: { path, status: response.status(), navigation: response.request().isNavigationRequest() } })}\n`,
      );
  });
  page.on('requestfailed', (request) => {
    const path = new URL(request.url()).pathname.replace(
      /(\/(?:remote-)?review-summaries\/)[^/]+/,
      '$1[redacted]',
    );
    if (/^\/(?:remote-)?review-summaries\//.test(path))
      app.output.push(
        `${JSON.stringify({ summaryBrowserFailure: { path, failure: request.failure(), navigation: request.isNavigationRequest() } })}\n`,
      );
  });
  page.on('requestfinished', (request) => {
    const path = new URL(request.url()).pathname.replace(
      /(\/(?:remote-)?review-summaries\/)[^/]+/,
      '$1[redacted]',
    );
    if (/^\/(?:remote-)?review-summaries\//.test(path))
      app.output.push(
        `${JSON.stringify({ summaryBrowserFinished: { path, navigation: request.isNavigationRequest() } })}\n`,
      );
  });

  return async (heading: string) => {
    try {
      await expect(
        page
          .frameLocator('iframe[title="Review summary"]')
          .getByRole('heading', { name: heading, exact: true }),
      ).toBeVisible();
    } catch (error) {
      try {
        const native = await app.electron.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().flatMap((view) =>
            view.webContents.mainFrame.framesInSubtree.map((frame) => ({
              path: URL.parse(frame.url)?.pathname.replace(
                /(\/(?:remote-)?review-summaries\/)[^/]+/,
                '$1[redacted]',
              ),
              processId: frame.processId,
              routingId: frame.routingId,
            })),
          ),
        );
        await testInfo.attach('summary-frame-state', {
          body: JSON.stringify({
            native,
            iframeRequest,
            playwright: page.frames().map((frame) => ({
              path: URL.parse(frame.url())?.pathname.replace(
                /(\/(?:remote-)?review-summaries\/)[^/]+/,
                '$1[redacted]',
              ),
              detached: frame.isDetached(),
            })),
          }),
          contentType: 'application/json',
        });
      } catch {
        app.output.push('Summary frame diagnostics were unavailable\n');
      }
      throw error;
    }
  };
}
