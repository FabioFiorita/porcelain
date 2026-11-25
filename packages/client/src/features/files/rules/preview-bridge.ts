export const PREVIEW_BRIDGE_SCRIPT =
  "(function(){var s=document.currentScript;if(s)s.remove();addEventListener('click',function(e){var t=e.target,a=t&&t.closest?t.closest('a[href],area[href]'):null;if(!a)return;var h=a.getAttribute('href')||'';e.preventDefault();if(h.charAt(0)==='#'){var i='';try{i=decodeURIComponent(h.slice(1))}catch(x){}var n=i?document.getElementById(i)||document.getElementsByName(i)[0]:null;if(n)n.scrollIntoView();else if(!i)scrollTo(0,0);return}top.postMessage({porcelainPreviewLink:h},'*')},true)})()";

const MAX_HREF_LENGTH = 4096;

export function previewLinkHref(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const href: unknown = Reflect.get(data, 'porcelainPreviewLink');
  return typeof href === 'string' && href.length <= MAX_HREF_LENGTH
    ? href
    : undefined;
}
