type CopyNotice = {
  title: string;
  description: string;
  type: 'success' | 'error';
};
type CopyListener = (notice: CopyNotice) => void;

const listeners = new Set<CopyListener>();

export function onCopyNotice(listener: CopyListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announce(notice: CopyNotice) {
  for (const listener of [...listeners]) listener(notice);
}

export function copyText(text: string, label: string) {
  const done = () =>
    announce({
      title: `Copied ${label}`,
      description: text,
      type: 'success',
    });
  const failed = () =>
    announce({
      title: `Could not copy ${label}`,
      description: text,
      type: 'error',
    });

  if (
    window.isSecureContext &&
    navigator.clipboard !== null &&
    navigator.clipboard !== undefined
  ) {
    navigator.clipboard.writeText(text).then(done, () => {
      if (legacyCopy(text)) done();
      else failed();
    });
    return;
  }
  if (legacyCopy(text)) done();
  else failed();
}

function legacyCopy(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
