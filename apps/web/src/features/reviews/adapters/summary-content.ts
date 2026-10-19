export function hasAgentSummary(page: string): boolean {
  const body = page.toLowerCase().lastIndexOf('</body>');
  const end = body === -1 ? page.length : body;
  const bridge = page.lastIndexOf('<style id="porcelain-theme">', end);
  const html = (
    bridge === -1 ? page : page.slice(0, bridge) + page.slice(end)
  ).trim();
  return (
    html.length > 0 && html !== '<!doctype html><html><body></body></html>'
  );
}
