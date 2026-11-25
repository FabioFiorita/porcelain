export function pageRoot() {
  return typeof document === 'undefined' ? null : document.body;
}
