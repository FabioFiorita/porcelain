const PAGE_BRIDGE = `<style id="porcelain-theme">:root{color-scheme:light dark;--porcelain-background:#fff;--porcelain-foreground:#171717}:root[data-theme=light]{color-scheme:light;--porcelain-background:#fff;--porcelain-foreground:#171717}:root[data-theme=dark]{color-scheme:dark;--porcelain-background:#111;--porcelain-foreground:#eee}@media(prefers-color-scheme:dark){:root:not([data-theme]){--porcelain-background:#111;--porcelain-foreground:#eee}}</style><script>(()=>{const apply=t=>{if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}};const hash=()=>{const t=new URLSearchParams(location.hash.slice(1)).get('theme');apply(t)};hash();addEventListener('hashchange',hash);addEventListener('message',e=>{if(e.source!==parent||!e.data||e.data.source!=='porcelain'||e.data.type!=='theme')return;apply(e.data.theme)});addEventListener('click',e=>{const a=e.target instanceof Element?e.target.closest('a[href]'):null;if(!a)return;const m=/^#layer-(\\d+)$/.exec(a.getAttribute('href')||'');if(!m)return;e.preventDefault();parent.postMessage({source:'porcelain-summary',openLayer:Number(m[1])},'*')})})()</script>`;

export function summaryPage(html: string): string {
  const body = html.toLowerCase().lastIndexOf('</body>');
  return body === -1
    ? `${html}${PAGE_BRIDGE}`
    : `${html.slice(0, body)}${PAGE_BRIDGE}${html.slice(body)}`;
}
